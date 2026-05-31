import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  CommandId,
  EventId,
  ThreadApprovalGate,
  ThreadApprovalGateId,
  type CreateThreadApprovalGateInput,
  type ListThreadApprovalGatesInput,
  type ListThreadApprovalGatesResult,
  type ThreadApprovalGate as ThreadApprovalGateType,
  type ThreadApprovalGateIdInput,
  type ThreadApprovalGateResult,
} from "@t3tools/contracts";
import { Effect, Layer, Schema, ServiceMap } from "effect";

import { ServerConfig } from "../../config.ts";
import { ApprovalServiceError } from "../Errors.ts";
import { OrchestrationEngineService } from "./OrchestrationEngine.ts";

export type ThreadApprovalGateExecution =
  | Effect.Effect<void, unknown>
  | Promise<void>
  | (() => Effect.Effect<void, unknown> | Promise<void> | void)
  | void;

export type ThreadApprovalGateCallbacks = {
  readonly onApprove?: ThreadApprovalGateExecution;
  readonly onReject?: ThreadApprovalGateExecution;
};

type ThreadApprovalServiceOptions = {
  readonly stateDir: string;
  readonly now?: () => string;
  readonly generateId?: () => string;
  readonly appendActivity?: (gate: ThreadApprovalGateType, action: GateActivityAction) => Effect.Effect<void, unknown>;
};

type GateActivityAction = "create" | "approve" | "reject";

export interface ThreadApprovalServiceShape {
  readonly createGate: (
    input: CreateThreadApprovalGateInput,
    callbacks?: ThreadApprovalGateCallbacks,
  ) => Effect.Effect<ThreadApprovalGateResult, ApprovalServiceError>;

  readonly approveGate: (
    input: ThreadApprovalGateIdInput,
  ) => Effect.Effect<ThreadApprovalGateResult, ApprovalServiceError>;

  readonly rejectGate: (
    input: ThreadApprovalGateIdInput,
  ) => Effect.Effect<ThreadApprovalGateResult, ApprovalServiceError>;

  readonly listGates: (
    input: ListThreadApprovalGatesInput,
  ) => Effect.Effect<ListThreadApprovalGatesResult, ApprovalServiceError>;
}

export class ThreadApprovalService extends ServiceMap.Service<
  ThreadApprovalService,
  ThreadApprovalServiceShape
>()("rowl/orchestration/Services/ThreadApprovalService") {}

export function createThreadApprovalService(
  options: ThreadApprovalServiceOptions,
): ThreadApprovalServiceShape {
  const now = options.now ?? (() => new Date().toISOString());
  const generateId = options.generateId ?? (() => randomUUID());
  const callbacksByGateId = new Map<string, ThreadApprovalGateCallbacks>();

  const withError = <A>(operation: string, run: () => Promise<A>) =>
    Effect.tryPromise({
      try: run,
      catch: (cause) =>
        new ApprovalServiceError({
          operation,
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

  const createGate: ThreadApprovalServiceShape["createGate"] = (
    input: CreateThreadApprovalGateInput,
    callbacks?: ThreadApprovalGateCallbacks,
  ) =>
    withError("createThreadApprovalGate", async () => {
      const gate: ThreadApprovalGateType = {
        id: ThreadApprovalGateId.makeUnsafe(generateId()),
        threadId: input.threadId,
        turnId: input.turnId,
        type: input.type,
        description: input.description,
        proposedChange: input.proposedChange,
        status: "pending",
        createdAt: now(),
      };
      await writeGate(options.stateDir, gate);
      if (callbacks) {
        callbacksByGateId.set(gate.id, callbacks);
      }
      await runEffect(options.appendActivity?.(gate, "create"));
      return { gate };
    });

  const approveGate: ThreadApprovalServiceShape["approveGate"] = (input) =>
    transitionGate(input.id, "approved", "approve", callbacksByGateId.get(input.id)?.onApprove);

  const rejectGate: ThreadApprovalServiceShape["rejectGate"] = (input) =>
    transitionGate(input.id, "rejected", "reject", callbacksByGateId.get(input.id)?.onReject);

  const listGates: ThreadApprovalServiceShape["listGates"] = (input) =>
    withError("listThreadApprovalGates", async () => ({
      gates: await listGatesForThread(options.stateDir, input.threadId),
    }));

  function transitionGate(
    id: ThreadApprovalGateIdInput["id"],
    status: "approved" | "rejected",
    action: GateActivityAction,
    callback: ThreadApprovalGateExecution,
  ) {
    return withError(`${action}ThreadApprovalGate`, async () => {
      const current = await findGate(options.stateDir, id);
      if (current.status !== "pending") {
        return { gate: current };
      }

      const gate: ThreadApprovalGateType = { ...current, status };
      await writeGate(options.stateDir, gate);
      await runExecution(callback);
      callbacksByGateId.delete(id);
      await runEffect(options.appendActivity?.(gate, action));
      return { gate };
    });
  }

  return {
    createGate,
    approveGate,
    rejectGate,
    listGates,
  };
}

export const ThreadApprovalServiceLive = Layer.effect(
  ThreadApprovalService,
  Effect.gen(function* () {
    const { stateDir } = yield* ServerConfig;
    const orchestrationEngine = yield* OrchestrationEngineService;
    return createThreadApprovalService({
      stateDir,
      appendActivity: (gate, action) =>
        orchestrationEngine.dispatch({
          type: "thread.activity.append",
          commandId: CommandId.makeUnsafe(`approval-gate:${action}:${gate.id}`),
          threadId: gate.threadId,
          activity: {
            id: EventId.makeUnsafe(`approval-gate:${action}:${gate.id}`),
            tone: action === "reject" ? "error" : "approval",
            kind: `approval-gate.${action === "create" ? "created" : action === "approve" ? "approved" : "rejected"}`,
            summary:
              action === "create"
                ? gate.description
                : action === "approve"
                  ? "Approval gate approved"
                  : `Approval rejected: ${gate.description}`,
            payload: {
              gateId: gate.id,
              type: gate.type,
              status: gate.status,
              proposedChange: gate.proposedChange,
            },
            turnId: gate.turnId,
            createdAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        }).pipe(Effect.asVoid),
    });
  }),
);

function gatesRoot(stateDir: string): string {
  return path.join(stateDir, "thread-approval-gates");
}

function gateThreadDir(stateDir: string, threadId: string): string {
  return path.join(gatesRoot(stateDir), safeSegment(threadId));
}

function gatePath(stateDir: string, threadId: string, gateId: string): string {
  return path.join(gateThreadDir(stateDir, threadId), `${safeSegment(gateId)}.json`);
}

async function writeGate(stateDir: string, gate: ThreadApprovalGateType): Promise<void> {
  const filePath = gatePath(stateDir, gate.threadId, gate.id);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
}

async function readGate(
  stateDir: string,
  threadId: string,
  gateId: string,
): Promise<ThreadApprovalGateType> {
  const raw = JSON.parse(await fs.readFile(gatePath(stateDir, threadId, gateId), "utf8"));
  return Schema.decodeUnknownSync(ThreadApprovalGate)(raw);
}

async function findGate(
  stateDir: string,
  gateId: string,
): Promise<ThreadApprovalGateType> {
  let threadDirs: string[];
  try {
    threadDirs = await fs.readdir(gatesRoot(stateDir));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Unknown approval gate: ${gateId}`);
    }
    throw cause;
  }

  for (const threadId of threadDirs) {
    try {
      return await readGate(stateDir, threadId, gateId);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw cause;
    }
  }

  throw new Error(`Unknown approval gate: ${gateId}`);
}

async function listGatesForThread(
  stateDir: string,
  threadId: string,
): Promise<ThreadApprovalGateType[]> {
  const dir = gateThreadDir(stateDir, threadId);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw cause;
  }

  const gates: ThreadApprovalGateType[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    gates.push(await readGate(stateDir, threadId, path.basename(entry, ".json")));
  }
  gates.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return gates;
}

async function runExecution(execution: ThreadApprovalGateExecution): Promise<void> {
  if (!execution) return;
  if (typeof execution === "function") {
    await runExecution(execution());
    return;
  }
  if (Effect.isEffect(execution)) {
    await Effect.runPromise(execution);
    return;
  }
  await execution;
}

async function runEffect(effect: Effect.Effect<void, unknown> | undefined): Promise<void> {
  if (!effect) return;
  await Effect.runPromise(effect);
}

function safeSegment(value: string): string {
  if (value.includes("/") || value.includes("\\") || value === "." || value === "..") {
    throw new Error(`Invalid path segment: ${value}`);
  }
  return value;
}

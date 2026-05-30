import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  ApprovalGate,
  ApprovalGateId,
  type ApprovalGate as ApprovalGateType,
  type ApproveInput,
  type CreateApprovalInput,
  type RejectInput,
} from "@t3tools/contracts";
import { Effect, Layer, Schema } from "effect";

import { ServerConfig } from "../../config.ts";
import { ApprovalServiceError } from "../Errors.ts";
import { goalDir } from "../goalFileStorage.ts";
import { ApprovalService, type ApprovalServiceShape } from "../Services/ApprovalService.ts";

type ApprovalServiceOptions = {
  readonly stateDir: string;
  readonly now?: () => string;
  readonly generateId?: () => string;
};

export function createApprovalService(options: ApprovalServiceOptions): ApprovalServiceShape {
  const now = options.now ?? (() => new Date().toISOString());
  const generateId = options.generateId ?? (() => randomUUID());

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

  const createApproval: ApprovalServiceShape["createApproval"] = (input: CreateApprovalInput) =>
    withError("createApproval", async () => {
      const approval: ApprovalGateType = {
        id: ApprovalGateId.makeUnsafe(generateId()),
        goalId: input.goalId,
        ...(input.documentId ? { documentId: input.documentId } : {}),
        status: "pending",
        requestedBy: input.requestedBy,
        ...(input.reason ? { reason: input.reason } : {}),
        createdAt: now(),
      };
      await writeApproval(options.stateDir, approval);
      return { approval };
    });

  const approve: ApprovalServiceShape["approve"] = (input: ApproveInput) =>
    transitionApproval(options.stateDir, "approve", input, "approved");

  const reject: ApprovalServiceShape["reject"] = (input: RejectInput) =>
    transitionApproval(options.stateDir, "reject", input, "rejected");

  const listApprovalsByGoal: ApprovalServiceShape["listApprovalsByGoal"] = (input) =>
    withError("listApprovalsByGoal", async () => ({
      approvals: await listApprovals(options.stateDir, input.goalId),
    }));

  const isGoalApproved: ApprovalServiceShape["isGoalApproved"] = (input) =>
    withError("isGoalApproved", async () => {
      const approvals = await listApprovals(options.stateDir, input.goalId);
      return {
        approved:
          approvals.length > 0 && approvals.every((approval) => approval.status === "approved"),
      };
    });

  function transitionApproval(
    stateDir: string,
    operation: string,
    input: ApproveInput | RejectInput,
    status: "approved" | "rejected",
  ) {
    return withError(operation, async () => {
      const current = await readApproval(stateDir, input.goalId, input.approvalId);
      const approval: ApprovalGateType = {
        ...current,
        status,
        reviewedBy: input.reviewedBy,
        ...(input.reason ? { reason: input.reason } : {}),
      };
      await writeApproval(stateDir, approval);
      return { approval };
    });
  }

  return {
    createApproval,
    approve,
    reject,
    listApprovalsByGoal,
    isGoalApproved,
  };
}

export const ApprovalServiceLive = Layer.effect(
  ApprovalService,
  Effect.gen(function* () {
    const { stateDir } = yield* ServerConfig;
    return createApprovalService({ stateDir });
  }),
);

function approvalsDir(stateDir: string, goalId: string): string {
  return path.join(goalDir(stateDir, safeSegment(goalId)), "approvals");
}

function approvalPath(stateDir: string, goalId: string, approvalId: string): string {
  return path.join(approvalsDir(stateDir, goalId), `${safeSegment(approvalId)}.json`);
}

async function readApproval(
  stateDir: string,
  goalId: string,
  approvalId: string,
): Promise<ApprovalGateType> {
  const raw = JSON.parse(await fs.readFile(approvalPath(stateDir, goalId, approvalId), "utf8"));
  return Schema.decodeUnknownSync(ApprovalGate)(raw);
}

async function writeApproval(stateDir: string, approval: ApprovalGateType): Promise<void> {
  const filePath = approvalPath(stateDir, approval.goalId, approval.id);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(approval, null, 2)}\n`, "utf8");
}

async function listApprovals(stateDir: string, goalId: string): Promise<ApprovalGateType[]> {
  const dir = approvalsDir(stateDir, goalId);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw cause;
  }

  const approvals: ApprovalGateType[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    approvals.push(await readApproval(stateDir, goalId, path.basename(entry, ".json")));
  }
  approvals.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return approvals;
}

function safeSegment(value: string): string {
  if (value.includes("/") || value.includes("\\") || value === "." || value === "..") {
    throw new Error(`Invalid path segment: ${value}`);
  }
  return value;
}

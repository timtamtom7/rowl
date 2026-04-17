import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";

import * as acp from "@agentclientprotocol/sdk";
import {
  ApprovalRequestId,
  EventId,
  KILOCODE_DEFAULT_MODEL,
  type ProviderApprovalDecision,
  type ProviderRuntimeEvent,
  type ProviderSession,
  type ProviderSessionStartInput,
  RuntimeItemId,
  RuntimeRequestId,
  ThreadId,
  TurnId,
  type ProviderTurnStartResult,
} from "@t3tools/contracts";

import {
  createPermissionOutcome,
  extractTextFromContentBlock,
  killChildTree,
  mapPlanEntryStatus,
  mapToolCallStatus,
  mapToolKindToItemType,
  mapToolKindToRequestType,
  permissionDecisionFromOutcome,
  providerLog,
  readResumeSessionId,
  summarizeToolContent,
  toMessage,
  type AcpPermissionRequestType,
} from "./provider/acpRuntimeShared.ts";

interface PendingApprovalRequest {
  readonly requestId: ApprovalRequestId;
  readonly toolCallId: string;
  readonly turnId: TurnId | undefined;
  readonly requestType: AcpPermissionRequestType;
  readonly options: ReadonlyArray<acp.PermissionOption>;
  readonly resolve: (response: acp.RequestPermissionResponse) => void;
}

interface ToolSnapshot {
  readonly kind: acp.ToolKind | null;
  readonly title: string;
}

interface KiloCodeSessionContext {
  session: ProviderSession;
  child: ChildProcessWithoutNullStreams;
  connection: acp.ClientSideConnection;
  acpSessionId: string;
  models: acp.SessionModelState | null;
  pendingApprovals: Map<ApprovalRequestId, PendingApprovalRequest>;
  toolSnapshots: Map<string, ToolSnapshot>;
  currentTurnId: TurnId | undefined;
  turnInFlight: boolean;
  stopping: boolean;
  lastStderrLine?: string;
}

export interface KiloCodeAcpStartSessionInput {
  readonly threadId: ThreadId;
  readonly provider?: "kilocode";
  readonly cwd?: string;
  readonly model?: string;
  readonly resumeCursor?: unknown;
  readonly providerOptions?: ProviderSessionStartInput["providerOptions"];
  readonly runtimeMode: ProviderSession["runtimeMode"];
}

export interface KiloCodeThreadTurnSnapshot {
  readonly id: TurnId;
  readonly items: ReadonlyArray<unknown>;
}

export interface KiloCodeThreadSnapshot {
  readonly threadId: ThreadId;
  readonly turns: ReadonlyArray<KiloCodeThreadTurnSnapshot>;
}

export interface KiloCodeAcpManagerEvents {
  event: [event: ProviderRuntimeEvent];
}

const KILOCODE_ACP_INITIALIZE_TIMEOUT_MS = 10_000;
const KILOCODE_ACP_SESSION_START_TIMEOUT_MS = 10_000;

export function isKiloCodeDefaultModel(model: string | null | undefined): boolean {
  return model?.trim() === KILOCODE_DEFAULT_MODEL;
}

function normalizeRequestedKiloCodeModel(model: string | null | undefined): string | undefined {
  const trimmed = model?.trim();
  if (!trimmed || isKiloCodeDefaultModel(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function readAvailableKiloCodeModelIds(
  models: acp.SessionModelState | null | undefined,
): ReadonlyArray<string> {
  return models?.availableModels.map((entry) => entry.modelId) ?? [];
}

export function isKiloCodeModelAvailable(
  models: acp.SessionModelState | null | undefined,
  model: string,
): boolean {
  const availableModelIds = readAvailableKiloCodeModelIds(models);
  return availableModelIds.length === 0 || availableModelIds.includes(model);
}

export function buildKiloCodeCliArgs(input: { readonly cwd: string }): ReadonlyArray<string> {
  return ["acp", "--cwd", input.cwd];
}

export function normalizeKiloCodeStartErrorMessage(rawMessage: string): string {
  if (/auth[_ ]required|authentication required|not logged in|oauth|login/i.test(rawMessage)) {
    return "KiloCode requires authentication. Complete the Kilo Gateway OAuth flow and try again.";
  }

  if (/api.?key|unauthorized|invalid.*token/i.test(rawMessage)) {
    return "KiloCode authentication failed. Re-authenticate through the Kilo Gateway OAuth flow.";
  }

  if (/ENOENT|not found|command not found|no such file/i.test(rawMessage)) {
    return "KiloCode CLI (`kilo`) is not installed or not on PATH. Install KiloCode and try again, or set a custom binary path in Settings.";
  }

  if (/timed? ?out|timeout/i.test(rawMessage)) {
    return "KiloCode took too long to start. Check your network connection and try again.";
  }

  if (/rate.?limit|too many requests|429/i.test(rawMessage)) {
    return "KiloCode rate limit reached. Wait a moment and try again.";
  }

  return rawMessage;
}

function withTimeout<T>(input: {
  readonly label: string;
  readonly timeoutMs: number;
  readonly promise: Promise<T>;
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${input.label} timed out after ${input.timeoutMs}ms.`));
    }, input.timeoutMs);

    input.promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export class KiloCodeAcpManager extends EventEmitter<KiloCodeAcpManagerEvents> {
  private readonly sessions = new Map<ThreadId, KiloCodeSessionContext>();
  private readonly startingSessions = new Map<ThreadId, KiloCodeSessionContext>();

  private emitRuntimeEvent(event: ProviderRuntimeEvent) {
    this.emit("event", event);
  }

  private createEventBase(context: KiloCodeSessionContext) {
    return {
      eventId: EventId.makeUnsafe(randomUUID()),
      provider: "kilocode" as const,
      threadId: context.session.threadId,
      createdAt: new Date().toISOString(),
    };
  }

  private updateSession(
    context: KiloCodeSessionContext,
    patch: Partial<ProviderSession>,
  ): ProviderSession {
    context.session = {
      ...context.session,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return context.session;
  }

  private emitSessionConfigured(context: KiloCodeSessionContext) {
    if (!context.models) {
      return;
    }

    this.emitRuntimeEvent({
      ...this.createEventBase(context),
      type: "session.configured",
      payload: {
        config: {
          currentModelId: context.models.currentModelId,
          availableModels: context.models.availableModels,
        },
      },
    });
  }

  private emitSessionStarted(context: KiloCodeSessionContext) {
    const sessionStarted: ProviderRuntimeEvent = {
      ...this.createEventBase(context),
      type: "session.started",
      payload: {
        message: "Connected to KiloCode ACP server.",
        resume: context.session.resumeCursor,
      },
    };
    const threadStarted: ProviderRuntimeEvent = {
      ...this.createEventBase(context),
      type: "thread.started",
      payload: {
        providerThreadId: context.acpSessionId,
      },
    };
    this.emitRuntimeEvent(sessionStarted);
    this.emitRuntimeEvent(threadStarted);
    this.emitSessionConfigured(context);
  }

  private emitSessionExit(
    context: KiloCodeSessionContext,
    input: {
      readonly reason?: string;
      readonly exitKind: "graceful" | "error";
      readonly recoverable?: boolean;
    },
  ) {
    this.emitRuntimeEvent({
      ...this.createEventBase(context),
      type: "session.exited",
      payload: {
        ...(input.reason ? { reason: input.reason } : {}),
        exitKind: input.exitKind,
        recoverable: input.recoverable ?? false,
      },
    });
  }

  private emitRuntimeError(context: KiloCodeSessionContext, message: string, turnId?: TurnId) {
    this.emitRuntimeEvent({
      ...this.createEventBase(context),
      ...(turnId ? { turnId } : {}),
      type: "runtime.error",
      payload: {
        message,
      },
    });
  }

  private resolvePendingApprovalsAsCancelled(context: KiloCodeSessionContext) {
    for (const pending of context.pendingApprovals.values()) {
      pending.resolve({ outcome: { outcome: "cancelled" } });
    }
    context.pendingApprovals.clear();
  }

  private handleSessionUpdate(context: KiloCodeSessionContext, params: acp.SessionNotification) {
    const turnId = context.currentTurnId;
    const createdAt = new Date().toISOString();
    const base = {
      ...this.createEventBase(context),
      ...(turnId ? { turnId } : {}),
      createdAt,
    };

    switch (params.update.sessionUpdate) {
      case "agent_message_chunk": {
        const delta = extractTextFromContentBlock(params.update.content);
        if (!delta || delta.length === 0) {
          return;
        }
        this.emitRuntimeEvent({
          ...base,
          ...(params.update.messageId
            ? { itemId: RuntimeItemId.makeUnsafe(params.update.messageId) }
            : {}),
          type: "content.delta",
          payload: {
            delta,
            streamKind: "assistant_text",
          },
        });
        return;
      }

      case "agent_thought_chunk": {
        const delta = extractTextFromContentBlock(params.update.content);
        if (!delta || delta.length === 0) {
          return;
        }
        this.emitRuntimeEvent({
          ...base,
          ...(params.update.messageId
            ? { itemId: RuntimeItemId.makeUnsafe(params.update.messageId) }
            : {}),
          type: "content.delta",
          payload: {
            delta,
            streamKind: "reasoning_text",
          },
        });
        return;
      }

      case "plan": {
        this.emitRuntimeEvent({
          ...base,
          type: "turn.plan.updated",
          payload: {
            plan: params.update.entries.map((entry) => ({
              step: entry.content,
              status: mapPlanEntryStatus(entry.status),
            })),
          },
        });
        return;
      }

      case "usage_update": {
        this.emitRuntimeEvent({
          ...base,
          type: "thread.token-usage.updated",
          payload: {
            usage: params.update,
          },
        });
        return;
      }

      case "tool_call": {
        context.toolSnapshots.set(params.update.toolCallId, {
          kind: params.update.kind ?? null,
          title: params.update.title,
        });
        this.emitRuntimeEvent({
          ...base,
          itemId: RuntimeItemId.makeUnsafe(params.update.toolCallId),
          type: "item.started",
          payload: {
            itemType: mapToolKindToItemType(params.update.kind),
            title: params.update.title,
            ...(mapToolCallStatus(params.update.status)
              ? { status: mapToolCallStatus(params.update.status) }
              : {}),
            ...(summarizeToolContent(params.update.content)
              ? { detail: summarizeToolContent(params.update.content) }
              : {}),
            data: {
              ...(params.update.locations ? { locations: params.update.locations } : {}),
              ...(params.update.rawInput !== undefined ? { rawInput: params.update.rawInput } : {}),
              ...(params.update.rawOutput !== undefined
                ? { rawOutput: params.update.rawOutput }
                : {}),
            },
          },
        });
        return;
      }

      case "tool_call_update": {
        const previous = context.toolSnapshots.get(params.update.toolCallId);
        const nextSnapshot = {
          kind: params.update.kind ?? previous?.kind ?? null,
          title: params.update.title ?? previous?.title ?? "Tool call",
        } satisfies ToolSnapshot;
        context.toolSnapshots.set(params.update.toolCallId, nextSnapshot);
        const status = params.update.status ?? null;
        const eventType =
          status === "completed" || status === "failed" ? "item.completed" : "item.updated";
        this.emitRuntimeEvent({
          ...base,
          itemId: RuntimeItemId.makeUnsafe(params.update.toolCallId),
          type: eventType,
          payload: {
            itemType: mapToolKindToItemType(nextSnapshot.kind),
            title: nextSnapshot.title,
            ...(mapToolCallStatus(status) ? { status: mapToolCallStatus(status) } : {}),
            ...(summarizeToolContent(params.update.content)
              ? { detail: summarizeToolContent(params.update.content) }
              : {}),
            ...(params.update.content ? { data: { content: params.update.content } } : {}),
          },
        });
        return;
      }

      default:
        return;
    }
  }

  private async requestPermission(
    context: KiloCodeSessionContext,
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    const requestId = ApprovalRequestId.makeUnsafe(randomUUID());
    const requestType = mapToolKindToRequestType(params.toolCall.kind);
    const detail = params.toolCall.title?.trim() ?? "Permission requested";

    this.emitRuntimeEvent({
      ...this.createEventBase(context),
      ...(context.currentTurnId ? { turnId: context.currentTurnId } : {}),
      requestId: RuntimeRequestId.makeUnsafe(requestId),
      type: "request.opened",
      payload: {
        requestType,
        ...(detail.length > 0 ? { detail } : {}),
      },
    });

    const response = await new Promise<acp.RequestPermissionResponse>((resolve) => {
      context.pendingApprovals.set(requestId, {
        requestId,
        toolCallId: params.toolCall.toolCallId,
        turnId: context.currentTurnId,
        requestType,
        options: params.options,
        resolve,
      });
    });

    context.pendingApprovals.delete(requestId);
    this.emitRuntimeEvent({
      ...this.createEventBase(context),
      ...(context.currentTurnId ? { turnId: context.currentTurnId } : {}),
      requestId: RuntimeRequestId.makeUnsafe(requestId),
      type: "request.resolved",
      payload: {
        requestType,
        decision: permissionDecisionFromOutcome(response.outcome, params.options),
      },
    });
    return response;
  }

  private attachProcessListeners(context: KiloCodeSessionContext) {
    context.child.stderr.setEncoding("utf8");
    context.child.stderr.on("data", (chunk: string) => {
      const trimmed = chunk.trim();
      if (trimmed.length > 0) {
        context.lastStderrLine = trimmed.split("\n").at(-1)?.trim() ?? trimmed;
      }
    });

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (!this.isTrackedContext(context)) {
        return;
      }

      this.resolvePendingApprovalsAsCancelled(context);
      this.updateSession(context, {
        status: "closed",
      });

      if (!context.stopping) {
        const reason =
          context.lastStderrLine ??
          (signal ? `KiloCode exited from signal ${signal}.` : undefined) ??
          (code !== null ? `KiloCode exited with code ${code}.` : "KiloCode exited.");
        this.emitSessionExit(context, {
          reason,
          exitKind: code === 0 ? "graceful" : "error",
        });
        if (code !== 0 && context.currentTurnId) {
          this.emitRuntimeError(context, reason, context.currentTurnId);
        }
      }

      this.deleteTrackedSession(context.session.threadId, context);
    };

    context.child.once("error", (error) => {
      context.lastStderrLine = toMessage(error, "Failed to start KiloCode CLI.");
      onExit(null, null);
    });

    context.child.once("exit", onExit);
    context.connection.closed.catch(() => undefined);
  }

  private requireSession(threadId: ThreadId): KiloCodeSessionContext {
    const context = this.sessions.get(threadId);
    if (!context) {
      throw new Error(`Unknown KiloCode session: ${threadId}`);
    }
    if (context.session.status === "closed") {
      throw new Error(`KiloCode session is closed: ${threadId}`);
    }
    return context;
  }

  private async setSessionModel(context: KiloCodeSessionContext, model: string) {
    const availableModelIds = readAvailableKiloCodeModelIds(context.models);
    if (availableModelIds.length > 0 && !availableModelIds.includes(model)) {
      throw new Error(
        `KiloCode does not expose model '${model}' for this session. Available models: ${availableModelIds.join(", ")}.`,
      );
    }

    try {
      await context.connection.unstable_setSessionModel({
        sessionId: context.acpSessionId,
        modelId: model,
      });
      if (context.models) {
        context.models = {
          ...context.models,
          currentModelId: model,
        };
      }
      this.updateSession(context, { model });
      this.emitSessionConfigured(context);
    } catch (error) {
      throw new Error(toMessage(error, `Failed to switch KiloCode model to '${model}'.`), {
        cause: error,
      });
    }
  }

  async startSession(input: KiloCodeAcpStartSessionInput): Promise<ProviderSession> {
    if (this.sessions.has(input.threadId) || this.startingSessions.has(input.threadId)) {
      throw new Error(
        `KiloCode already has a session starting or running for thread '${input.threadId}'.`,
      );
    }

    const resolvedCwd = input.cwd ?? process.cwd();
    const now = new Date().toISOString();
    const previousContext = this.sessions.get(input.threadId);
    const session: ProviderSession = {
      provider: "kilocode",
      status: "connecting",
      runtimeMode: input.runtimeMode,
      model: input.model,
      cwd: resolvedCwd,
      threadId: input.threadId,
      createdAt: now,
      updatedAt: now,
    };

    const kilocodeBinaryPath = input.providerOptions?.kilocode?.binaryPath ?? "kilo";
    const args = buildKiloCodeCliArgs({ cwd: resolvedCwd });

    const child = spawn(kilocodeBinaryPath, args, {
      cwd: resolvedCwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    const stream = acp.ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout));
    let context: KiloCodeSessionContext | undefined;

    const client: acp.Client = {
      requestPermission: async (params) => {
        if (!context) {
          return { outcome: { outcome: "cancelled" } };
        }
        return this.requestPermission(context, params);
      },
      sessionUpdate: async (params) => {
        if (!context) {
          return;
        }
        this.handleSessionUpdate(context, params);
      },
    };

    const connection = new acp.ClientSideConnection(() => client, stream);
    context = {
      session,
      child,
      connection,
      acpSessionId: "",
      models: null,
      pendingApprovals: new Map(),
      toolSnapshots: new Map(),
      currentTurnId: undefined,
      turnInFlight: false,
      stopping: false,
    };
    this.startingSessions.set(input.threadId, context);
    this.attachProcessListeners(context);

    try {
      const initializeResult = await withTimeout({
        label: "KiloCode ACP initialize",
        timeoutMs: KILOCODE_ACP_INITIALIZE_TIMEOUT_MS,
        promise: connection.initialize({
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: {},
        }),
      });

      const resumeSessionId = readResumeSessionId(input);
      const resumeSupported =
        initializeResult.agentCapabilities?.sessionCapabilities?.resume !== undefined;

      let sessionResult: acp.NewSessionResponse | acp.ResumeSessionResponse;
      if (resumeSessionId) {
        if (!resumeSupported) {
          throw new Error("KiloCode ACP server does not advertise session resume support.");
        }

        sessionResult = await withTimeout({
          label: "KiloCode ACP resumeSession",
          timeoutMs: KILOCODE_ACP_SESSION_START_TIMEOUT_MS,
          promise: connection.unstable_resumeSession({
            sessionId: resumeSessionId,
            cwd: resolvedCwd,
            mcpServers: [],
          }),
        });
        context.acpSessionId = resumeSessionId;
      } else {
        const createdSession = await withTimeout({
          label: "KiloCode ACP newSession",
          timeoutMs: KILOCODE_ACP_SESSION_START_TIMEOUT_MS,
          promise: connection.newSession({
            cwd: resolvedCwd,
            mcpServers: [],
          }),
        });
        sessionResult = createdSession;
        context.acpSessionId = createdSession.sessionId;
      }

      context.models = sessionResult.models ?? null;
      this.updateSession(context, {
        status: "ready",
        model: sessionResult.models?.currentModelId ?? session.model,
        resumeCursor: { sessionId: context.acpSessionId },
      });

      const requestedModel = normalizeRequestedKiloCodeModel(input.model);
      if (
        requestedModel &&
        requestedModel !== context.session.model &&
        isKiloCodeModelAvailable(context.models, requestedModel)
      ) {
        await this.setSessionModel(context, requestedModel);
      }

      this.emitSessionStarted(context);
      this.startingSessions.delete(input.threadId);
      this.sessions.set(input.threadId, context);
      if (previousContext && previousContext !== context) {
        await this.disposeContext(previousContext);
      }
      return { ...context.session };
    } catch (error) {
      const rawMessage =
        context.lastStderrLine ?? toMessage(error, "Failed to start KiloCode session.");
      const message = normalizeKiloCodeStartErrorMessage(rawMessage);
      this.startingSessions.delete(input.threadId);
      this.updateSession(context, {
        status: "error",
        lastError: message,
      });
      this.emitRuntimeError(context, message);
      if (this.isTrackedContext(context)) {
        this.emitSessionExit(context, {
          reason: message,
          exitKind: "error",
        });
      }
      await this.disposeContext(context);
      throw new Error(message, { cause: error });
    }
  }

  async sendTurn(input: {
    readonly threadId: ThreadId;
    readonly input?: string;
    readonly attachments?: ReadonlyArray<unknown>;
    readonly model?: string;
  }): Promise<ProviderTurnStartResult> {
    const context = this.requireSession(input.threadId);
    const promptText = input.input?.trim();
    if (!promptText) {
      throw new Error("KiloCode turns require a non-empty text prompt.");
    }
    if ((input.attachments?.length ?? 0) > 0) {
      throw new Error("KiloCode integration currently supports text prompts only.");
    }

    if (
      context.turnInFlight ||
      context.session.status === "running" ||
      context.session.activeTurnId
    ) {
      throw new Error("KiloCode already has a turn in progress for this session.");
    }

    context.turnInFlight = true;

    try {
      const requestedModel = normalizeRequestedKiloCodeModel(input.model);
      if (requestedModel && requestedModel !== context.session.model) {
        if (isKiloCodeModelAvailable(context.models, requestedModel)) {
          await this.setSessionModel(context, requestedModel);
        } else {
          const availableModelIds = readAvailableKiloCodeModelIds(context.models);
          const modelListInfo =
            availableModelIds.length > 0
              ? ` Available models: ${availableModelIds.join(", ")}.`
              : " No models are currently available from KiloCode.";
          throw new Error(
            `KiloCode does not have access to model '${requestedModel}'.${modelListInfo} Select one of the available models or reconfigure your KiloCode provider.`,
          );
        }
      }

      const turnId = TurnId.makeUnsafe(randomUUID());
      context.currentTurnId = turnId;
      this.updateSession(context, {
        status: "running",
        activeTurnId: turnId,
      });

      providerLog(
        "Turn",
        `Starting turn ${turnId} for thread ${input.threadId}, model: ${context.session.model ?? "default"}`,
      );

      this.emitRuntimeEvent({
        ...this.createEventBase(context),
        turnId,
        type: "turn.started",
        payload: context.session.model ? { model: context.session.model } : {},
      });

      try {
        const result = await context.connection.prompt({
          sessionId: context.acpSessionId,
          prompt: [
            {
              type: "text",
              text: promptText,
            },
          ],
        });

        providerLog("Turn", `Turn ${turnId} completed with stopReason: ${result.stopReason}`);

        this.emitRuntimeEvent({
          ...this.createEventBase(context),
          turnId,
          type: "turn.completed",
          payload: {
            state: result.stopReason === "cancelled" ? "interrupted" : "completed",
            stopReason: result.stopReason,
            ...(result.usage ? { usage: result.usage } : {}),
          },
        });

        this.updateSession(context, {
          status: "ready",
          activeTurnId: undefined,
        });

        return {
          threadId: input.threadId,
          turnId,
          resumeCursor: { sessionId: context.acpSessionId },
        };
      } catch (error) {
        const message = toMessage(error, "KiloCode turn failed.");
        this.emitRuntimeEvent({
          ...this.createEventBase(context),
          turnId,
          type: "turn.completed",
          payload: {
            state: "failed",
            stopReason: null,
            errorMessage: message,
          },
        });
        this.emitRuntimeError(context, message, turnId);
        this.updateSession(context, {
          status: "error",
          activeTurnId: undefined,
          lastError: message,
        });
        throw new Error(message, { cause: error });
      }
    } finally {
      context.currentTurnId = undefined;
      context.turnInFlight = false;
    }
  }

  async interruptTurn(threadId: ThreadId, turnId?: TurnId): Promise<void> {
    const context = this.requireSession(threadId);
    if (turnId && context.currentTurnId && turnId !== context.currentTurnId) {
      return;
    }
    this.resolvePendingApprovalsAsCancelled(context);
    await context.connection.cancel({ sessionId: context.acpSessionId });
  }

  async respondToRequest(
    threadId: ThreadId,
    requestId: ApprovalRequestId,
    decision: ProviderApprovalDecision,
  ): Promise<void> {
    const context = this.requireSession(threadId);
    const pending = context.pendingApprovals.get(requestId);
    if (!pending) {
      throw new Error(`Unknown pending KiloCode approval request: ${requestId}`);
    }
    pending.resolve(createPermissionOutcome(decision, pending.options));
  }

  async respondToUserInput(): Promise<void> {
    throw new Error("KiloCode ACP does not expose structured user input requests in Rowl yet.");
  }

  async stopSession(threadId: ThreadId): Promise<void> {
    const context = this.sessions.get(threadId) ?? this.startingSessions.get(threadId);
    if (!context) {
      return;
    }

    await this.disposeContext(context);
    this.emitSessionExit(context, {
      reason: "KiloCode session stopped.",
      exitKind: "graceful",
      recoverable: true,
    });
  }

  private deleteTrackedSession(threadId: ThreadId, context: KiloCodeSessionContext): void {
    if (this.sessions.get(threadId) === context) {
      this.sessions.delete(threadId);
    }
    if (this.startingSessions.get(threadId) === context) {
      this.startingSessions.delete(threadId);
    }
  }

  private isTrackedContext(context: KiloCodeSessionContext): boolean {
    const threadId = context.session.threadId;
    return (
      this.sessions.get(threadId) === context || this.startingSessions.get(threadId) === context
    );
  }

  private async disposeContext(context: KiloCodeSessionContext): Promise<void> {
    providerLog("Session", `Disposing KiloCode session for thread ${context.session.threadId}`);
    context.stopping = true;
    this.resolvePendingApprovalsAsCancelled(context);
    try {
      await context.connection.cancel({ sessionId: context.acpSessionId });
    } catch {
      // Best-effort cancellation only.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    if (!context.child.killed) {
      providerLog("Session", `Sending SIGKILL to KiloCode child process ${context.child.pid}`);
      killChildTree(context.child, "SIGKILL");
    }
    this.updateSession(context, {
      status: "closed",
      activeTurnId: undefined,
    });
    this.deleteTrackedSession(context.session.threadId, context);
    providerLog("Session", `KiloCode session disposed for thread ${context.session.threadId}`);
  }

  async listSessions(): Promise<ReadonlyArray<ProviderSession>> {
    return Array.from(this.sessions.values(), (context) => context.session);
  }

  async hasSession(threadId: ThreadId): Promise<boolean> {
    return this.sessions.has(threadId) || this.startingSessions.has(threadId);
  }

  async readThread(threadId: ThreadId): Promise<KiloCodeThreadSnapshot> {
    this.requireSession(threadId);
    throw new Error(
      "Reading historical KiloCode thread snapshots is not implemented in this ACP integration yet.",
    );
  }

  async rollbackThread(threadId: ThreadId, _numTurns: number): Promise<KiloCodeThreadSnapshot> {
    this.requireSession(threadId);
    throw new Error("Rolling back KiloCode threads is not supported by this integration.");
  }

  async stopAll(): Promise<void> {
    const threadIds = [...new Set([...this.sessions.keys(), ...this.startingSessions.keys()])];
    await Promise.all(threadIds.map((threadId) => this.stopSession(threadId)));
  }
}

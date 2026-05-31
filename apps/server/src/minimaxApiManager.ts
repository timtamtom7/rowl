import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

import {
  ApprovalRequestId,
  EventId,
  type ProviderApprovalDecision,
  type ProviderRuntimeEvent,
  type ProviderSession,
  type ProviderSessionStartInput,
  RuntimeItemId,
  ThreadId,
  TurnId,
  type ProviderTurnStartResult,
} from "@t3tools/contracts";

import { providerLog, toMessage } from "./provider/acpRuntimeShared.ts";

const MINIMAX_API_BASE_URL = "https://api.minimaxi.chat/v1";
const MINIMAX_DEFAULT_MODEL = "MiniMax-M2.7";

function normalizeMiniMaxApiError(status: number, errorText: string): string {
  switch (status) {
    case 401:
      return "MiniMax API key is invalid or expired. Check your API key in Settings.";
    case 403:
      return "MiniMax API access denied. Your API key may not have permission for this model.";
    case 429:
      return "MiniMax API rate limit reached. Wait a moment and try again.";
    case 402:
      return "MiniMax API payment required. Check your MiniMax account balance.";
    case 500:
    case 502:
    case 503:
      return "MiniMax API is temporarily unavailable. Try again in a few moments.";
    default: {
      if (errorText && errorText.length > 0 && errorText.length < 200) {
        return `MiniMax API error: ${errorText}`;
      }
      return `MiniMax API returned an error (status ${status}). Check your API key and try again.`;
    }
  }
}

export function normalizeMiniMaxStartErrorMessage(rawMessage: string): string {
  if (/api.?key|unauthorized|authentication|invalid.*key/i.test(rawMessage)) {
    return "MiniMax requires an API key. Add a MiniMax API key in Rowl Settings.";
  }
  if (/rate.?limit|too many requests|429/i.test(rawMessage)) {
    return "MiniMax API rate limit reached. Wait a moment and try again.";
  }
  return rawMessage;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ReadonlyArray<{ type: string; text?: string; image_url?: { url: string } }>;
  tool_calls?: ReadonlyArray<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface MiniMaxSessionContext {
  session: ProviderSession;
  apiKey: string;
  conversationHistory: ChatMessage[];
  currentTurnId: TurnId | undefined;
  turnInFlight: boolean;
  stopping: boolean;
  abortController: AbortController | null;
}

export interface MiniMaxApiStartSessionInput {
  readonly threadId: ThreadId;
  readonly provider?: "minimax";
  readonly cwd?: string;
  readonly model?: string;
  readonly resumeCursor?: unknown;
  readonly providerOptions?: ProviderSessionStartInput["providerOptions"];
  readonly runtimeMode: ProviderSession["runtimeMode"];
}

export interface MiniMaxThreadTurnSnapshot {
  readonly id: TurnId;
  readonly items: ReadonlyArray<unknown>;
}

export interface MiniMaxThreadSnapshot {
  readonly threadId: ThreadId;
  readonly turns: ReadonlyArray<MiniMaxThreadTurnSnapshot>;
}

export interface MiniMaxApiManagerEvents {
  event: [event: ProviderRuntimeEvent];
}

export class MiniMaxApiManager extends EventEmitter<MiniMaxApiManagerEvents> {
  private readonly sessions = new Map<ThreadId, MiniMaxSessionContext>();
  private readonly startingSessions = new Map<ThreadId, MiniMaxSessionContext>();

  private emitRuntimeEvent(event: ProviderRuntimeEvent) {
    this.emit("event", event);
  }

  private createEventBase(context: MiniMaxSessionContext) {
    return {
      eventId: EventId.makeUnsafe(randomUUID()),
      provider: "minimax" as const,
      threadId: context.session.threadId,
      createdAt: new Date().toISOString(),
    };
  }

  private updateSession(
    context: MiniMaxSessionContext,
    patch: Partial<ProviderSession>,
  ): ProviderSession {
    context.session = {
      ...context.session,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return context.session;
  }

  private emitSessionStarted(context: MiniMaxSessionContext) {
    const sessionStarted: ProviderRuntimeEvent = {
      ...this.createEventBase(context),
      type: "session.started",
      payload: {
        message: "Connected to MiniMax API.",
      },
    };
    const threadStarted: ProviderRuntimeEvent = {
      ...this.createEventBase(context),
      type: "thread.started",
      payload: {},
    };
    this.emitRuntimeEvent(sessionStarted);
    this.emitRuntimeEvent(threadStarted);
  }

  private emitSessionExit(
    context: MiniMaxSessionContext,
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

  private emitRuntimeError(context: MiniMaxSessionContext, message: string, turnId?: TurnId) {
    this.emitRuntimeEvent({
      ...this.createEventBase(context),
      ...(turnId ? { turnId } : {}),
      type: "runtime.error",
      payload: {
        message,
      },
    });
  }

  private requireSession(threadId: ThreadId): MiniMaxSessionContext {
    const context = this.sessions.get(threadId);
    if (!context) {
      throw new Error(`Unknown MiniMax session: ${threadId}`);
    }
    if (context.session.status === "closed") {
      throw new Error(`MiniMax session is closed: ${threadId}`);
    }
    return context;
  }

  async startSession(input: MiniMaxApiStartSessionInput): Promise<ProviderSession> {
    if (this.sessions.has(input.threadId) || this.startingSessions.has(input.threadId)) {
      throw new Error(
        `MiniMax already has a session starting or running for thread '${input.threadId}'.`,
      );
    }

    const apiKey = input.providerOptions?.minimax?.apiKey;
    if (!apiKey) {
      throw new Error(
        "MiniMax requires an API key. Add a MiniMax API key in Rowl Settings or provide it via providerOptions.",
      );
    }

    const resolvedCwd = input.cwd ?? process.cwd();
    const model = input.model ?? MINIMAX_DEFAULT_MODEL;
    const now = new Date().toISOString();
    const session: ProviderSession = {
      provider: "minimax",
      status: "connecting",
      runtimeMode: input.runtimeMode,
      model,
      cwd: resolvedCwd,
      threadId: input.threadId,
      createdAt: now,
      updatedAt: now,
    };

    const context: MiniMaxSessionContext = {
      session,
      apiKey,
      conversationHistory: [],
      currentTurnId: undefined,
      turnInFlight: false,
      stopping: false,
      abortController: null,
    };

    this.startingSessions.set(input.threadId, context);

    try {
      this.updateSession(context, {
        status: "ready",
      });

      this.emitSessionStarted(context);
      this.startingSessions.delete(input.threadId);
      this.sessions.set(input.threadId, context);
      return { ...context.session };
    } catch (error) {
      const rawMessage = toMessage(error, "Failed to start MiniMax session.");
      const message = normalizeMiniMaxStartErrorMessage(rawMessage);
      this.startingSessions.delete(input.threadId);
      this.updateSession(context, {
        status: "error",
        lastError: message,
      });
      this.emitRuntimeError(context, message);
      this.emitSessionExit(context, {
        reason: message,
        exitKind: "error",
      });
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
      throw new Error("MiniMax turns require a non-empty text prompt.");
    }

    if (
      context.turnInFlight ||
      context.session.status === "running" ||
      context.session.activeTurnId
    ) {
      throw new Error("MiniMax already has a turn in progress for this session.");
    }

    context.turnInFlight = true;
    const abortController = new AbortController();
    context.abortController = abortController;

    try {
      if (input.model && input.model !== context.session.model) {
        this.updateSession(context, { model: input.model });
      }

      const turnId = TurnId.makeUnsafe(randomUUID());
      context.currentTurnId = turnId;
      this.updateSession(context, {
        status: "running",
        activeTurnId: turnId,
      });

      const model = context.session.model ?? MINIMAX_DEFAULT_MODEL;

      providerLog(
        "Turn",
        `Starting MiniMax turn ${turnId} for thread ${input.threadId}, model: ${model}`,
      );

      this.emitRuntimeEvent({
        ...this.createEventBase(context),
        turnId,
        type: "turn.started",
        payload: { model },
      });

      // Build user message with optional image attachments
      const userMessage = this.buildUserMessage(promptText, input.attachments);
      context.conversationHistory.push(userMessage);

      try {
        const assistantContent = await this.streamChatCompletion(
          context,
          turnId,
          model,
          abortController.signal,
        );

        // Store assistant response in conversation history
        context.conversationHistory.push({
          role: "assistant",
          content: assistantContent,
        });

        providerLog("Turn", `MiniMax turn ${turnId} completed`);

        this.emitRuntimeEvent({
          ...this.createEventBase(context),
          turnId,
          type: "turn.completed",
          payload: {
            state: "completed",
            stopReason: "end_turn",
          },
        });

        this.updateSession(context, {
          status: "ready",
          activeTurnId: undefined,
        });

        return {
          threadId: input.threadId,
          turnId,
        };
      } catch (error) {
        if (abortController.signal.aborted) {
          // Remove the user message we just added since the turn was cancelled
          context.conversationHistory.pop();

          this.emitRuntimeEvent({
            ...this.createEventBase(context),
            turnId,
            type: "turn.completed",
            payload: {
              state: "interrupted",
              stopReason: "cancelled",
            },
          });

          this.updateSession(context, {
            status: "ready",
            activeTurnId: undefined,
          });

          return {
            threadId: input.threadId,
            turnId,
          };
        }

        const message = toMessage(error, "MiniMax turn failed.");
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
      context.abortController = null;
    }
  }

  private buildUserMessage(text: string, attachments?: ReadonlyArray<unknown>): ChatMessage {
    if (!attachments || attachments.length === 0) {
      return { role: "user", content: text };
    }

    // Build multimodal content with image support
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: "text", text },
    ];

    for (const attachment of attachments) {
      if (
        attachment &&
        typeof attachment === "object" &&
        "type" in attachment &&
        attachment.type === "image" &&
        "url" in attachment &&
        typeof attachment.url === "string"
      ) {
        content.push({
          type: "image_url",
          image_url: { url: attachment.url },
        });
      }
    }

    return { role: "user", content };
  }

  private async streamChatCompletion(
    context: MiniMaxSessionContext,
    turnId: TurnId,
    model: string,
    signal: AbortSignal,
  ): Promise<string> {
    const url = `${MINIMAX_API_BASE_URL}/chat/completions`;

    // Surgical context trimming: if conversation is large, strip old tool call results
    // but keep conversation messages and recent tool calls intact.
    // The Valo insight: 80% of context weight is tool call results, not conversation.
    const KEEP_RECENT_MESSAGES = 10;
    const MAX_CONTENT_LENGTH = 4000; // ~1000 tokens per message max for old messages
    const messages = context.conversationHistory.map((msg, idx) => {
      const isRecent = idx >= context.conversationHistory.length - KEEP_RECENT_MESSAGES;
      let content = msg.content;

      // For older messages, trim very long content (likely tool call results)
      if (!isRecent && typeof content === "string" && content.length > MAX_CONTENT_LENGTH) {
        // Keep first 200 chars as summary + tombstone
        const preview = content.slice(0, 200).replace(/\n/g, " ");
        content = `[Trimmed: ${preview}... (${Math.round(content.length / 4)} tokens freed)]`;
      }

      return {
        role: msg.role,
        content,
        ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
        ...(msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : {}),
      };
    });

    const body = {
      model,
      messages,
      stream: true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${context.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(normalizeMiniMaxApiError(response.status, errorText));
    }

    if (!response.body) {
      throw new Error("MiniMax API returned no response body for streaming request.");
    }

    let fullContent = "";
    const messageId = RuntimeItemId.makeUnsafe(randomUUID());
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            if (!delta) continue;

            // Handle content delta
            if (delta.content) {
              fullContent += delta.content;
              this.emitRuntimeEvent({
                ...this.createEventBase(context),
                turnId,
                itemId: messageId,
                type: "content.delta",
                payload: {
                  delta: delta.content,
                  streamKind: "assistant_text",
                },
              });
            }

            // Handle reasoning/thinking content
            if (delta.reasoning_content) {
              this.emitRuntimeEvent({
                ...this.createEventBase(context),
                turnId,
                itemId: messageId,
                type: "content.delta",
                payload: {
                  delta: delta.reasoning_content,
                  streamKind: "reasoning_text",
                },
              });
            }

            // Handle usage info from the final chunk
            if (parsed.usage) {
              this.emitRuntimeEvent({
                ...this.createEventBase(context),
                turnId,
                type: "thread.token-usage.updated",
                payload: {
                  usage: parsed.usage,
                },
              });
            }
          } catch {
            // Skip malformed SSE data lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent;
  }

  async interruptTurn(threadId: ThreadId, turnId?: TurnId): Promise<void> {
    const context = this.requireSession(threadId);
    if (turnId && context.currentTurnId && turnId !== context.currentTurnId) {
      return;
    }
    context.abortController?.abort();
  }

  async respondToRequest(
    _threadId: ThreadId,
    _requestId: ApprovalRequestId,
    _decision: ProviderApprovalDecision,
  ): Promise<void> {
    throw new Error("MiniMax direct API does not use approval requests.");
  }

  async respondToUserInput(): Promise<void> {
    throw new Error("MiniMax API does not expose structured user input requests.");
  }

  async stopSession(threadId: ThreadId): Promise<void> {
    const context = this.sessions.get(threadId) ?? this.startingSessions.get(threadId);
    if (!context) {
      return;
    }

    context.stopping = true;
    context.abortController?.abort();
    this.updateSession(context, {
      status: "closed",
      activeTurnId: undefined,
    });
    this.deleteTrackedSession(threadId, context);
    this.emitSessionExit(context, {
      reason: "MiniMax session stopped.",
      exitKind: "graceful",
      recoverable: false,
    });
  }

  private deleteTrackedSession(threadId: ThreadId, context: MiniMaxSessionContext): void {
    if (this.sessions.get(threadId) === context) {
      this.sessions.delete(threadId);
    }
    if (this.startingSessions.get(threadId) === context) {
      this.startingSessions.delete(threadId);
    }
  }

  async listSessions(): Promise<ReadonlyArray<ProviderSession>> {
    return Array.from(this.sessions.values(), (context) => context.session);
  }

  async hasSession(threadId: ThreadId): Promise<boolean> {
    return this.sessions.has(threadId) || this.startingSessions.has(threadId);
  }

  async readThread(threadId: ThreadId): Promise<MiniMaxThreadSnapshot> {
    this.requireSession(threadId);
    throw new Error("Reading historical MiniMax thread snapshots is not implemented yet.");
  }

  async rollbackThread(threadId: ThreadId, _numTurns: number): Promise<MiniMaxThreadSnapshot> {
    this.requireSession(threadId);
    throw new Error("Rolling back MiniMax threads is not supported by this integration.");
  }

  async stopAll(): Promise<void> {
    const threadIds = [...new Set([...this.sessions.keys(), ...this.startingSessions.keys()])];
    await Promise.all(threadIds.map((threadId) => this.stopSession(threadId)));
  }
}

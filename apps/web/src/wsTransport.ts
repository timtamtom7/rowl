import {
  type WsPush,
  type WsPushChannel,
  type WsPushMessage,
  WebSocketResponse,
  type WsResponse as WsResponseMessage,
  WsResponse as WsResponseSchema,
} from "@t3tools/contracts";
import { decodeUnknownJsonResult, formatSchemaError } from "@t3tools/shared/schemaJson";
import { Exit, Result, Schema } from "effect";
import { resolveConfiguredWsUrl } from "./lib/serverUrl";

type PushListener<C extends WsPushChannel> = (message: WsPushMessage<C>) => void;

interface RequestOptions<T> {
  readonly resultSchema?: Schema.Schema<T>;
}

interface PendingRequest {
  envelope: WsRequestEnvelope;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  sent: boolean;
  resultSchema?: Schema.Schema<unknown>;
}

interface SubscribeOptions {
  readonly replayLatest?: boolean;
}

export type TransportState = "connecting" | "open" | "reconnecting" | "closed" | "disposed";

const REQUEST_TIMEOUT_MS = 60_000;
const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000];
const decodeWsResponse = decodeUnknownJsonResult(WsResponseSchema);
const isWebSocketResponseEnvelope = Schema.is(WebSocketResponse);

const isWsPushMessage = (value: WsResponseMessage): value is WsPush =>
  "type" in value && value.type === "push";

const resolveDefaultWsUrl = (): string => resolveConfiguredWsUrl({ stripLocationToken: true });

interface WsRequestEnvelope {
  id: string;
  body: {
    _tag: string;
    [key: string]: unknown;
  };
}

export class WsTransport {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Map<string, Set<(message: WsPush) => void>>();
  private readonly latestPushByChannel = new Map<string, WsPush>();
  private readonly stateListeners = new Set<(state: TransportState) => void>();
  private readonly ignoredSockets = new WeakSet<WebSocket>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private state: TransportState = "connecting";
  private readonly explicitUrl: string | undefined;
  private readonly unsubscribeBridgeWsUrl: (() => void) | null;
  private currentResolvedUrl: string | null = null;

  constructor(url?: string) {
    this.explicitUrl = url;
    this.unsubscribeBridgeWsUrl =
      !url && typeof window !== "undefined" && window.desktopBridge
        ? window.desktopBridge.onBackendWsUrlUpdated((nextUrl) => {
            if (this.disposed || typeof nextUrl !== "string" || nextUrl.length === 0) {
              return;
            }
            if (this.currentResolvedUrl === nextUrl && this.state !== "closed") {
              return;
            }
            this.reconnectNow();
          })
        : null;
    this.connect();
  }

  async request<T = unknown>(
    method: string,
    params?: unknown,
    options?: RequestOptions<T>,
  ): Promise<T> {
    if (typeof method !== "string" || method.length === 0) {
      throw new Error("Request method is required");
    }

    const id = String(this.nextId++);
    const body = params != null ? { ...params, _tag: method } : { _tag: method };
    const envelope: WsRequestEnvelope = { id, body };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        envelope,
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout,
        sent: false,
        ...(options?.resultSchema ? { resultSchema: options.resultSchema } : {}),
      });

      this.flushPendingRequests();
    });
  }

  subscribe<C extends WsPushChannel>(
    channel: C,
    listener: PushListener<C>,
    options?: SubscribeOptions,
  ): () => void {
    let channelListeners = this.listeners.get(channel);
    if (!channelListeners) {
      channelListeners = new Set<(message: WsPush) => void>();
      this.listeners.set(channel, channelListeners);
    }

    const wrappedListener = (message: WsPush) => {
      listener(message as WsPushMessage<C>);
    };
    channelListeners.add(wrappedListener);

    if (options?.replayLatest) {
      const latest = this.latestPushByChannel.get(channel);
      if (latest) {
        wrappedListener(latest);
      }
    }

    return () => {
      channelListeners?.delete(wrappedListener);
      if (channelListeners?.size === 0) {
        this.listeners.delete(channel);
      }
    };
  }

  getLatestPush<C extends WsPushChannel>(channel: C): WsPushMessage<C> | null {
    const latest = this.latestPushByChannel.get(channel);
    return latest ? (latest as WsPushMessage<C>) : null;
  }

  getState(): TransportState {
    return this.state;
  }

  subscribeState(listener: (state: TransportState) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  dispose() {
    this.disposed = true;
    this.setState("disposed");
    this.unsubscribeBridgeWsUrl?.();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Transport disposed"));
    }
    this.pending.clear();
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    if (this.disposed) {
      return;
    }

    this.setState(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");
    const resolvedUrl = this.explicitUrl ?? resolveDefaultWsUrl();
    this.currentResolvedUrl = resolvedUrl || null;
    if (!resolvedUrl) {
      console.warn("WebSocket connect deferred awaiting desktop backend URL");
      this.scheduleReconnect();
      return;
    }

    console.warn(`WebSocket connecting url=${resolvedUrl}`);

    const ws = new WebSocket(resolvedUrl);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.setState("open");
      this.reconnectAttempt = 0;
      this.flushPendingRequests();
    });

    ws.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    ws.addEventListener("close", () => {
      if (this.ignoredSockets.has(ws)) {
        this.ignoredSockets.delete(ws);
        return;
      }
      if (this.ws === ws) {
        this.ws = null;
      }
      if (this.disposed) {
        this.setState("disposed");
        return;
      }
      this.latestPushByChannel.clear();
      this.setState("closed");
      this.rejectSentPendingRequests();
      this.scheduleReconnect();
    });

    ws.addEventListener("error", (event) => {
      // Log WebSocket errors for debugging (close event will follow)
      const resolvedUrl = this.explicitUrl ?? resolveDefaultWsUrl();
      console.warn(`WebSocket connection error type=${event.type} url=${resolvedUrl || "<empty>"}`);
    });
  }

  private reconnectNow() {
    if (this.disposed) {
      return;
    }

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const activeSocket = this.ws;
    if (activeSocket) {
      this.ignoredSockets.add(activeSocket);
      this.ws = null;
      activeSocket.close();
    }

    this.latestPushByChannel.clear();
    this.rejectSentPendingRequests();
    this.reconnectAttempt = 0;
    this.connect();
  }

  private handleMessage(raw: unknown) {
    const result = decodeWsResponse(raw);
    if (Result.isFailure(result)) {
      console.warn("Dropped inbound WebSocket envelope", formatSchemaError(result.failure));
      return;
    }

    const message = result.success;
    if (isWsPushMessage(message)) {
      this.latestPushByChannel.set(message.channel, message);
      const channelListeners = this.listeners.get(message.channel);
      if (channelListeners) {
        for (const listener of channelListeners) {
          try {
            listener(message);
          } catch {
            // Swallow listener errors
          }
        }
      }
      return;
    }

    if (!isWebSocketResponseEnvelope(message)) {
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(message.id);

    if (message.error) {
      pending.reject(new Error(message.error.message));
      return;
    }

    const rawResult = "result" in message ? message.result : undefined;
    if (!pending.resultSchema) {
      pending.resolve(rawResult);
      return;
    }

    const decodedResult = Schema.decodeUnknownExit(pending.resultSchema as never)(rawResult);
    if (Exit.isFailure(decodedResult)) {
      pending.reject(
        new Error(
          `Invalid response payload for ${pending.envelope.body._tag}: ${formatSchemaError(decodedResult.cause)}`,
        ),
      );
      return;
    }

    pending.resolve(decodedResult.value);
  }

  private flushPendingRequests() {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    for (const pending of this.pending.values()) {
      if (pending.sent) {
        continue;
      }
      this.ws.send(JSON.stringify(pending.envelope));
      pending.sent = true;
    }
  }

  private rejectSentPendingRequests() {
    for (const [id, pending] of this.pending) {
      if (!pending.sent) {
        continue;
      }
      clearTimeout(pending.timeout);
      pending.reject(new Error("WebSocket disconnected before a response was received"));
      this.pending.delete(id);
    }
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer !== null) {
      return;
    }

    const delay =
      RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)] ??
      RECONNECT_DELAYS_MS[0]!;

    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setState(next: TransportState) {
    if (this.state === next) {
      return;
    }

    this.state = next;
    for (const listener of this.stateListeners) {
      try {
        listener(next);
      } catch {
        // Swallow listener errors
      }
    }
  }
}

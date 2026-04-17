/**
 * OverseerReactorLive - Background AI monitoring for non-coders.
 *
 * Subscribes to provider runtime events and domain events, runs detection
 * patterns, and appends Overseer activities to the timeline when issues
 * are found.
 */
import { randomUUID } from "node:crypto";
import {
  EventId,
  type OrchestrationEvent,
  type ProviderRuntimeEvent,
} from "@t3tools/contracts";
import { Cause, Effect, Layer, Stream } from "effect";
import { makeDrainableWorker } from "@t3tools/shared/DrainableWorker";

import { CodebaseIntelligence } from "../Services/CodebaseIntelligence.ts";
import { ContextService } from "../Services/ContextService.ts";
import { EvaluatorService } from "../Services/EvaluatorService.ts";
import { HandoffService } from "../Services/HandoffService.ts";
import { MemoryService } from "../Services/MemoryService.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { OverseerReactor, type OverseerReactorShape } from "../Services/OverseerReactor.ts";
import { ProviderService } from "../../provider/Services/ProviderService.ts";

// ── Detection patterns ─────────────────────────────────────────────

const CAPABILITY_FORGETFULNESS_PATTERNS = [
  /I (?:can't|cannot|don't have (?:access|ability)|am (?:unable|not able)) (?:to )?(?:read|write|edit|execute|run|access|modify|create|delete)/i,
  /you(?:'ll| will| would) need to (?:run|do|execute|open|edit|modify) (?:that|this|it) yourself/i,
  /I don't have access to (?:the )?(?:file ?system|terminal|shell|command line|your (?:files|code|project))/i,
  /(?:please |could you )?(?:run|execute|open|type) (?:this|that|the following) (?:command|in your terminal)/i,
];

const DANGEROUS_COMMAND_PATTERNS = [
  {
    pattern: /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|--force\s+)?-[a-zA-Z]*r/i,
    label: "Recursive file deletion",
  },
  { pattern: /DROP\s+(?:TABLE|DATABASE|SCHEMA)/i, label: "Database drop operation" },
  { pattern: /git\s+push\s+(?:--force|-f)\b/i, label: "Force push to remote" },
  { pattern: /git\s+reset\s+--hard/i, label: "Hard reset (destructive)" },
  { pattern: /chmod\s+(?:777|666)\s/i, label: "Overly permissive file permissions" },
];

const TECHNICAL_DELEGATION_PATTERNS = [
  /(?:run|execute|type|enter|paste) (?:this |the following )?(?:in (?:your )?terminal|(?:this )?command)/i,
  /open (?:a |your )?(?:terminal|command (?:line|prompt)|shell|console)/i,
  /you(?:'ll| will) need to (?:install|configure|set up|update) /i,
];

// Detect uncertainty/hedging in AI output
const UNCERTAINTY_PATTERNS = [
  {
    pattern: /(?:I(?:'m| am) (?:not (?:sure|certain|confident)|unsure)|(?:this )?(?:might|may|could) (?:not )?(?:work|be correct|be right|be the best|be wrong))/i,
    label: "uncertainty",
  },
  {
    pattern: /(?:I think (?:this )?(?:should|might|could)|probably|I believe|if I(?:'m| am) not mistaken)/i,
    label: "hedging",
  },
  {
    pattern: /(?:I(?:'m| am) not (?:sure|certain) (?:if|whether|about|how))/i,
    label: "uncertainty",
  },
  {
    pattern: /(?:this is (?:a |my )?(?:guess|assumption|rough (?:estimate|approximation)))/i,
    label: "low-confidence",
  },
];

function checkUncertainty(text: string): string | null {
  for (const { pattern } of UNCERTAINTY_PATTERNS) {
    if (pattern.test(text)) {
      return "The AI expressed uncertainty about this. Review this section carefully or ask it to verify.";
    }
  }
  return null;
}

// Detect when the AI claims to have completed work without verification
const PREMATURE_COMPLETION_PATTERNS = [
  {
    pattern: /(?:I(?:'ve| have) (?:finished|completed|done|built|created|implemented|set up) (?:the |your |a )?(?:feature|page|component|system|module|app|application|site|website))/i,
    label: "completion-claim",
  },
  {
    pattern: /(?:everything (?:is|should be) (?:working|ready|set up|done|complete|good to go))/i,
    label: "broad-completion-claim",
  },
  {
    pattern: /(?:you can now (?:use|see|access|open|try|test|view) (?:the |your |a )?(?:feature|page|app|site|login|dashboard|form))/i,
    label: "usability-claim",
  },
  {
    pattern: /(?:Done[!.]?\s+\S+(?:\s+\S+){0,5}\s+(?:is|are|should be|will be)\s+(?:ready|done|working|complete)(?:\s+to\s+\S+)?)/i,
    label: "done-announcement",
  },
];

const recentErrorsByThread = new Map<string, string[]>();

function checkCapabilityForgetfulness(text: string): string | null {
  for (const pattern of CAPABILITY_FORGETFULNESS_PATTERNS) {
    if (pattern.test(text)) {
      return "The AI said it cannot do something it actually has tools for.";
    }
  }
  return null;
}

function checkTechnicalDelegation(text: string): string | null {
  for (const pattern of TECHNICAL_DELEGATION_PATTERNS) {
    if (pattern.test(text)) {
      return "The AI is asking you to do something technical. It should handle this itself.";
    }
  }
  return null;
}

function checkDangerousCommand(detail: string): string | null {
  for (const { pattern, label } of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(detail)) {
      return `Potentially dangerous command: ${label}`;
    }
  }
  return null;
}

function checkPrematureCompletion(text: string): string | null {
  for (const { pattern, label } of PREMATURE_COMPLETION_PATTERNS) {
    if (pattern.test(text)) {
      if (label === "broad-completion-claim") {
        return "The AI claims everything is working. Ask it to show you proof — what specific thing can you click or see?";
      }
      return "The AI says it built something. Before moving on, ask it to verify: does the feature actually work when you try it?";
    }
  }
  return null;
}

function checkLoopDetection(threadId: string, errorMsg: string): string | null {
  let errors = recentErrorsByThread.get(threadId);
  if (!errors) {
    errors = [];
    recentErrorsByThread.set(threadId, errors);
  }
  errors.push(errorMsg);
  if (errors.length > 5) errors.shift();

  if (errors.length >= 3) {
    const last3 = errors.slice(-3);
    if (last3[0] === last3[1] && last3[1] === last3[2]) {
      return "The AI has failed the same way 3 times in a row. It may be stuck.";
    }
  }
  return null;
}

// ── Reactor ─────────────────────────────────────────────────────────

type OverseerInput = {
  source: "runtime" | "domain";
  event: ProviderRuntimeEvent | OrchestrationEvent;
};

export const OverseerReactorLive = Layer.effect(
  OverseerReactor,
  Effect.gen(function* () {
    const orchestrationEngine = yield* OrchestrationEngineService;
    const providerService = yield* ProviderService;
    const codebaseIntelligence = yield* CodebaseIntelligence;
    const contextService = yield* ContextService;
    const evaluatorService = yield* EvaluatorService;
    const handoffService = yield* HandoffService;
    const memoryService = yield* MemoryService;

    const textBuffers = new Map<string, string>();
    const fileActivityBuffer: Array<{
      threadId: string;
      filePath: string;
      action: "read" | "write" | "create" | "delete";
      timestamp: string;
    }> = [];

    function appendActivity(
      threadId: string,
      turnId: string | null,
      kind: string,
      summary: string,
      payload?: Record<string, unknown>,
    ) {
      return orchestrationEngine.dispatch({
        type: "thread.activity.append",
        commandId: `overseer:${kind}:${randomUUID()}` as any,
        threadId: threadId as any,
        activity: {
          id: EventId.makeUnsafe(randomUUID()),
          tone: "error" as const,
          kind: `overseer.${kind}`,
          summary: `Overseer: ${summary}`,
          payload: payload ?? {},
          turnId: (turnId as any) ?? null,
          createdAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      });
    }

    const processInput = (input: OverseerInput) =>
      Effect.gen(function* () {
        // Handle domain events (orchestration events like turn-diff-completed)
        if (input.source === "domain") {
          const domainEvent = input.event as OrchestrationEvent;
          if (domainEvent.type === "thread.turn-diff-completed") {
            const payload = domainEvent.payload as any;
            const files = payload?.files;
            if (Array.isArray(files) && files.length > 0) {
              // Record file changes for codebase intelligence
              const readModel = yield* orchestrationEngine.getReadModel();
              const thread = readModel.threads.find((t: any) => t.id === payload.threadId);
              if (thread) {
                for (const file of files) {
                  const filePath = (file as any).path ?? (file as any).relativePath;
                  if (filePath) {
                    yield* codebaseIntelligence
                      .recordFileChange({
                        projectId: (thread as any).projectId,
                        filePath,
                      })
                      .pipe(Effect.catch(() => Effect.void));
                  }
                }
              }
            }
          }
          return;
        }

        if (input.source !== "runtime") return;
        const event = input.event as ProviderRuntimeEvent;

        switch (event.type) {
          case "content.delta": {
            if (event.payload.streamKind !== "assistant_text") break;
            const key = `${event.threadId}:${event.turnId ?? ""}`;
            const buf = (textBuffers.get(key) ?? "") + event.payload.delta;
            textBuffers.set(key, buf);

            if (buf.length % 500 < event.payload.delta.length) {
              const capIssue = checkCapabilityForgetfulness(buf);
              if (capIssue) {
                yield* appendActivity(
                  event.threadId,
                  event.turnId ?? null,
                  "capability-forgetfulness",
                  capIssue,
                );
                textBuffers.delete(key);
              }
              const techIssue = checkTechnicalDelegation(buf);
              if (techIssue) {
                yield* appendActivity(
                  event.threadId,
                  event.turnId ?? null,
                  "technical-delegation",
                  techIssue,
                );
                textBuffers.delete(key);
              }
              const completionIssue = checkPrematureCompletion(buf);
              if (completionIssue) {
                yield* appendActivity(
                  event.threadId,
                  event.turnId ?? null,
                  "premature-completion",
                  completionIssue,
                );
                textBuffers.delete(key);
                // Evaluation moved to turn.completed where read model is settled
              }
              const uncertaintyIssue = checkUncertainty(buf);
              if (uncertaintyIssue) {
                yield* appendActivity(
                  event.threadId,
                  event.turnId ?? null,
                  "certainty-warning",
                  uncertaintyIssue,
                );
                // Don't clear buffer — uncertainty is informational, not blocking
              }
            }
            break;
          }

          case "item.started": {
            if (event.payload.itemType === "command_execution" && event.payload.detail) {
              const danger = checkDangerousCommand(event.payload.detail);
              if (danger) {
                yield* appendActivity(
                  event.threadId,
                  event.turnId ?? null,
                  "dangerous-command",
                  danger,
                  {
                    command: event.payload.detail,
                  },
                );
              }
            }

            // Emit file activity for Live Map
            const fileItemTypes: Record<string, "read" | "write" | "create" | "delete"> = {
              file_read: "read",
              file_write: "write",
              file_edit: "write",
              file_create: "create",
            };
            const fileAction = fileItemTypes[event.payload.itemType];
            if (fileAction && event.payload.detail) {
              // Extract file path from detail (usually the first token or the full string)
              const filePath = event.payload.detail.split("\n")[0]?.trim() ?? event.payload.detail;
              if (filePath.length > 0 && filePath.length < 500) {
                fileActivityBuffer.push({
                  threadId: event.threadId,
                  filePath,
                  action: fileAction,
                  timestamp: new Date().toISOString(),
                });
              }
            }
            break;
          }

          case "turn.completed": {
            // Extract decisions/facts from the completed turn's text as memories
            const completedKey = `${event.threadId}:${event.turnId ?? ""}`;
            const completedText = textBuffers.get(completedKey);
            textBuffers.delete(completedKey);

            if (
              completedText &&
              completedText.length > 200 &&
              event.payload.state === "completed"
            ) {
              // Extract memories from completed turn text
              const memoryPatterns: Array<{
                pattern: RegExp;
                type: "decision" | "architecture" | "preference" | "fact";
                importance: number;
              }> = [
                // Architectural decisions
                { pattern: /(?:I (?:chose|decided|went with|picked|selected|used)|(?:Let's|We should|We'll) (?:use|go with|implement))\s+(.{20,150})/i, type: "decision", importance: 4 },
                { pattern: /(?:because|since|the reason is|this is better because)\s+(.{20,150})/i, type: "decision", importance: 3 },
                // Architecture patterns
                { pattern: /(?:created|added|set up|configured|installed)\s+(?:a |the )?(?:new )?(database|schema|table|migration|API|endpoint|route|service|component|hook|store|context|provider)\s+(.{10,100})/i, type: "architecture", importance: 3 },
                // File structure decisions
                { pattern: /(?:moved|renamed|split|merged|refactored|extracted)\s+(.{20,150})/i, type: "architecture", importance: 3 },
                // Configuration/preference
                { pattern: /(?:configured|set|enabled|disabled|updated)\s+(.{10,100})\s+(?:to|for|in|as)\s+(.{10,100})/i, type: "preference", importance: 2 },
                // Key facts about the project
                { pattern: /(?:the project|this app|this project|the codebase)\s+(?:uses|is built with|runs on|depends on)\s+(.{10,100})/i, type: "fact", importance: 3 },
              ];

              const readModel = yield* orchestrationEngine.getReadModel();
              const turnThread = readModel.threads.find((t: any) => t.id === event.threadId);
              if (turnThread) {
                let memoriesCreated = 0;
                for (const { pattern, type, importance } of memoryPatterns) {
                  if (memoriesCreated >= 2) break; // Max 2 memories per turn
                  const match = completedText.match(pattern);
                  if (match?.[1]) {
                    yield* memoryService
                      .createMemory({
                        projectId: (turnThread as any).projectId,
                        threadId: event.threadId as any,
                        type,
                        content: match[0]!.slice(0, 500),
                        summary: match[1]!.slice(0, 150),
                        importance,
                      })
                      .pipe(Effect.catch(() => Effect.void));
                    memoriesCreated++;
                  }
                }
              }
            }

            // Loop detection
            if (event.payload.state === "failed" && event.payload.errorMessage) {
              const loop = checkLoopDetection(event.threadId, event.payload.errorMessage);
              if (loop) {
                yield* appendActivity(event.threadId, event.turnId ?? null, "loop-detected", loop);
              }
            }

            // Context budget warning — check token usage from turn
            if (event.payload.state === "completed") {
              const usage = event.payload.usage as any;
              const totalTokens =
                typeof usage?.totalTokens === "number"
                  ? usage.totalTokens
                  : typeof usage?.input_tokens === "number"
                    ? usage.input_tokens + (usage.output_tokens ?? 0)
                    : 0;

              // Critical: auto-generate handoff briefing at 90%
              if (totalTokens > 180_000) {
                const readModel2 = yield* orchestrationEngine.getReadModel();
                const handoffThread = readModel2.threads.find(
                  (t: any) => t.id === event.threadId,
                );
                if (handoffThread) {
                  const briefing = yield* handoffService
                    .generateBriefing({
                      threadId: event.threadId as any,
                      projectId: (handoffThread as any).projectId,
                    })
                    .pipe(Effect.catch(() => Effect.succeed(null)));
                  if (briefing) {
                    yield* appendActivity(
                      event.threadId,
                      event.turnId ?? null,
                      "context-exhaustion",
                      `Context is nearly exhausted (~${Math.round(totalTokens / 1000)}K tokens). A handoff briefing has been prepared. Start a new thread titled "${briefing.suggestedNewThreadTitle}" to continue with full context.`,
                      { totalTokens, briefingAvailable: true },
                    );
                  }
                }
              } else if (totalTokens > 160_000) {
                yield* appendActivity(
                  event.threadId,
                  event.turnId ?? null,
                  "context-budget-high",
                  `Context usage is high (~${Math.round(totalTokens / 1000)}K tokens). Consider starting a new thread to avoid quality degradation.`,
                  { totalTokens },
                );
              }
            }

            // Run evaluator on completed turns (after read model is settled)
            if (event.payload.state === "completed") {
              const evalReadModel = yield* orchestrationEngine.getReadModel();
              const evalThread = evalReadModel.threads.find(
                (t: any) => t.id === event.threadId,
              );
              if (evalThread) {
                const evalResult = yield* evaluatorService
                  .evaluateThread({
                    threadId: event.threadId as any,
                    projectId: (evalThread as any).projectId,
                    claimedWork: "",
                  })
                  .pipe(Effect.catch(() => Effect.succeed(null)));
                if (evalResult && evalResult.status !== "pass") {
                  yield* appendActivity(
                    event.threadId,
                    event.turnId ?? null,
                    "evaluation-result",
                    `Evaluator: ${evalResult.summary}`,
                    { status: evalResult.status, checks: evalResult.checks },
                  );
                }
              }
            }

            // Auto-create context node for completed turns
            if (event.payload.state === "completed") {
              try {
                const readModel = yield* orchestrationEngine.getReadModel();
                const thread = readModel.threads.find((t: any) => t.id === event.threadId);
                if (thread) {
                  const usage = event.payload.usage as any;
                  const tokenCount =
                    typeof usage?.totalTokens === "number"
                      ? usage.totalTokens
                      : typeof usage?.input_tokens === "number" &&
                          typeof usage?.output_tokens === "number"
                        ? usage.input_tokens + usage.output_tokens
                        : 0;

                  const turnLabel = event.turnId ? `Turn ${event.turnId.slice(0, 8)}` : "Turn";
                  const summary = `${turnLabel}: ${event.payload.stopReason ?? "completed"}${tokenCount > 0 ? ` (${tokenCount} tokens)` : ""}`;

                  yield* contextService
                    .createContextNode({
                      projectId: (thread as any).projectId,
                      threadId: event.threadId as any,
                      type: "messages",
                      summary,
                      size: tokenCount,
                    } as any)
                    .pipe(Effect.catch(() => Effect.void));
                }
              } catch {
                // Don't let context node creation block the overseer
              }
            }
            break;
          }

          case "session.exited": {
            if (event.payload.exitKind === "error") {
              yield* appendActivity(
                event.threadId,
                null,
                "session-error",
                `AI session ended unexpectedly: ${event.payload.reason ?? "Unknown reason"}`,
                { reason: event.payload.reason },
              );
            }
            break;
          }
        }
      }).pipe(
        Effect.catch((cause) =>
          Effect.logWarning("overseer reactor failed to process input", {
            source: input.source,
            cause: String(cause),
          }),
        ),
      );

    const worker = yield* makeDrainableWorker(processInput);

    const start: OverseerReactorShape["start"] = Effect.gen(function* () {
      yield* Effect.forkScoped(
        Stream.runForEach(providerService.streamEvents, (event) =>
          worker.enqueue({ source: "runtime" as const, event }),
        ),
      );

      yield* Effect.forkScoped(
        Stream.runForEach(orchestrationEngine.streamDomainEvents, (event) =>
          worker.enqueue({ source: "domain" as const, event }),
        ),
      );
    });

    const drain: OverseerReactorShape["drain"] = worker.drain;

    return { start, drain } satisfies OverseerReactorShape;
  }),
);

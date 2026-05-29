/**
 * HandoffServiceLive — Structured briefing for new threads when context is exhausted.
 *
 * Generates a structured briefing capturing current task state, decisions,
 * goals, features, and recent conversation for transfer to a new thread.
 * Key decisions are also extracted as memory entries for long-term storage.
 *
 * @module HandoffServiceLive
 */
import { Effect, Layer } from "effect";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

import {
  HandoffService,
  type HandoffBriefing,
  type HandoffServiceShape,
} from "../Services/HandoffService.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { GoalsService } from "../Services/GoalsService.ts";
import { FeatureService } from "../Services/FeatureService.ts";
import { MemoryService } from "../Services/MemoryService.ts";

export const HandoffServiceLive = Layer.effect(
  HandoffService,
  Effect.gen(function* () {
    const orchestrationEngine = yield* OrchestrationEngineService;
    const goalsService = yield* GoalsService;
    const featureService = yield* FeatureService;
    const memoryService = yield* MemoryService;

    const generateBriefing: HandoffServiceShape["generateBriefing"] = (input) =>
      Effect.gen(function* () {
        const readModel = yield* orchestrationEngine.getReadModel();
        const thread = readModel.threads.find((t) => t.id === input.threadId);

        if (!thread) {
          return {
            threadTitle: "Unknown thread",
            briefingText: "Thread not found.",
            suggestedNewThreadTitle: "Continuation",
            memoriesExtracted: 0,
          } satisfies HandoffBriefing;
        }

        const parts: string[] = [];

        parts.push(`## Handoff from: ${thread.title}`);
        if ((thread as any).goal) {
          parts.push(`Thread Goal: ${(thread as any).goal}`);
        }

        // Recent conversation summary
        const messages = thread.messages ?? [];
        const recentMessages = messages
          .filter((m: any) => m.role === "user" || m.role === "assistant")
          .slice(-10);

        if (recentMessages.length > 0) {
          parts.push("\n## Recent Conversation");
          for (const msg of recentMessages) {
            const m = msg as any;
            const preview = (m.text ?? "").slice(0, 200);
            parts.push(`- **${m.role}**: ${preview}${(m.text ?? "").length > 200 ? "..." : ""}`);
          }
        }

        // Goals
        const goalsResult = yield* goalsService
          .listGoalsByProject({ projectId: input.projectId })
          .pipe(Effect.catch(() => Effect.succeed({ goals: [] as any[] })));
        if (goalsResult.goals.length > 0) {
          parts.push("\n## Active Goals");
          for (const g of goalsResult.goals) {
            const goal = g as any;
            parts.push(`- ${goal.isMain ? "**MAIN:** " : ""}${goal.text}`);
          }
        }

        // Features
        const featuresResult = yield* featureService
          .listFeaturesByProject({ projectId: input.projectId })
          .pipe(Effect.catch(() => Effect.succeed({ features: [] as any[] })));
        if (featuresResult.features.length > 0) {
          parts.push("\n## Feature Status");
          for (const f of featuresResult.features) {
            const feature = f as any;
            parts.push(`- [${feature.stage}] ${feature.name}`);
          }
        }

        // Extract decisions as memories
        let memoriesExtracted = 0;
        const lastAssistant = recentMessages.filter((m: any) => m.role === "assistant").pop();
        if (lastAssistant) {
          const text = (lastAssistant as any).text ?? "";
          if (text.length > 50) {
            yield* memoryService
              .createMemory({
                projectId: input.projectId,
                threadId: input.threadId,
                type: "context",
                content: text.slice(0, 2000),
                summary: `Handoff from "${thread.title}": ${text.slice(0, 100)}...`,
                importance: 4,
              })
              .pipe(Effect.catch(() => Effect.void));
            memoriesExtracted++;
          }
        }

        return {
          threadTitle: thread.title,
          briefingText: parts.join("\n"),
          suggestedNewThreadTitle: `${thread.title} (continued)`,
          memoriesExtracted,
        } satisfies HandoffBriefing;
      }).pipe(
        Effect.catch(() =>
          Effect.succeed({
            threadTitle: "Unknown",
            briefingText: "Failed to generate briefing.",
            suggestedNewThreadTitle: "Continuation",
            memoriesExtracted: 0,
          } satisfies HandoffBriefing),
        ),
      );

    return { generateBriefing } satisfies HandoffServiceShape;
  }),
);

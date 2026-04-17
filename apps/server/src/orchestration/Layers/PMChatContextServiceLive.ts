import { Effect, Layer } from "effect";
import type { ProjectId } from "@t3tools/contracts";

import { PMChatContextServiceError } from "../Errors.ts";
import {
  PMChatContextService,
  type PMChatProjectContext,
  type PMChatContextServiceShape,
} from "../Services/PMChatContextService.ts";
import { GoalsService } from "../Services/GoalsService.ts";
import { FeatureService } from "../Services/FeatureService.ts";
import { ContextService } from "../Services/ContextService.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";

export const PMChatContextServiceLive = Layer.effect(
  PMChatContextService,
  Effect.gen(function* () {
    const orchestrationEngine = yield* OrchestrationEngineService;
    const goalsService = yield* GoalsService;
    const featureService = yield* FeatureService;
    const contextService = yield* ContextService;

    const getProjectContext: PMChatContextServiceShape["getProjectContext"] = (
      projectId: ProjectId,
    ) =>
      Effect.gen(function* () {
        const readModel = yield* orchestrationEngine.getReadModel();

        const projectThreads = readModel.threads
          .filter((t: any) => t.projectId === projectId)
          .map((t: any) => ({
            threadId: t.id,
            title: t.title ?? "Untitled",
            goalStatement: t.goal ?? "",
            status: t.session?.status ?? "idle",
          }));

        const goalsResult = yield* goalsService
          .listGoalsByProject({ projectId })
          .pipe(Effect.catch(() => Effect.succeed({ goals: [] as any[] })));

        const featuresResult = yield* featureService
          .listFeaturesByProject({ projectId })
          .pipe(Effect.catch(() => Effect.succeed({ features: [] as any[] })));

        const contextResult = yield* contextService
          .listContextNodesByProject({ projectId })
          .pipe(
            Effect.catch(() =>
              Effect.succeed({
                nodes: [] as any[],
                budget: { total: 0, used: 0, available: 0, compressionRatio: 0 },
              }),
            ),
          );

        return {
          projectId,
          threads: projectThreads,
          features: featuresResult.features,
          goals: goalsResult.goals,
          contextNodes: contextResult.nodes,
        } as PMChatProjectContext;
      }).pipe(
        Effect.mapError(
          (cause) =>
            new PMChatContextServiceError({
              operation: "getProjectContext",
              detail: String(cause),
              cause,
            }),
        ),
      );

    return { getProjectContext } satisfies PMChatContextServiceShape;
  }),
);

/**
 * ContextBudgetCalculatorLive — Measures context budget usage per section.
 *
 * Reads the same data sources as ProviderCommandReactor.sendTurnForThread
 * but instead of assembling context for the provider, measures each section's
 * approximate token count. This powers the budget ring visualization.
 *
 * Token estimation: ~4 characters per token (English approximation).
 * This is deliberately approximate — exact counts require model-specific
 * tokenizers and vary by provider. The approximation is good enough for
 * a budget gauge (within ~10% of actual for English text).
 */
import { Effect, Layer } from "effect";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

import {
  ContextBudgetCalculator,
  type ContextBudgetBreakdown,
  type ContextBudgetCalculatorShape,
} from "../Services/ContextBudgetCalculator.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { GoalsService } from "../Services/GoalsService.ts";
import { FeatureService } from "../Services/FeatureService.ts";
import {
  readProjectAgentsFile,
  readProjectBriefFile,
} from "../../projectWorkspaceMetadata.ts";
import {
  parseLatestResumeContext,
  THREAD_SKILLS_ACTIVITY_KIND,
} from "../../threadArtifacts.ts";

// ── Token estimation ─────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// Known context window sizes by model family (conservative estimates)
const CONTEXT_WINDOW_BY_MODEL_PREFIX: Record<string, number> = {
  "o4": 200_000,
  "o3": 200_000,
  "gpt-4": 128_000,
  "gpt-5": 200_000,
  "claude": 200_000,
  "gemini": 1_000_000,
  "MiniMax": 1_000_000,
  "kilo-auto": 200_000,
};

function guessContextWindowLimit(model: string | null | undefined): number | null {
  if (!model) return null;
  for (const [prefix, limit] of Object.entries(CONTEXT_WINDOW_BY_MODEL_PREFIX)) {
    if (model.startsWith(prefix)) return limit;
  }
  return 200_000; // Conservative default
}

function resolveThreadWorkspaceCwd(
  thread: { projectId: string },
  projects: ReadonlyArray<{ id: string; workspaceRoot: string }>,
): string | null {
  const project = projects.find((p) => p.id === thread.projectId);
  return project?.workspaceRoot ?? null;
}

// ── Service implementation ────────────────────────────────────────────

export const ContextBudgetCalculatorLive = Layer.effect(
  ContextBudgetCalculator,
  Effect.gen(function* () {
    const orchestrationEngine = yield* OrchestrationEngineService;
    const goalsService = yield* GoalsService;
    const featureService = yield* FeatureService;

    const estimateForThread: ContextBudgetCalculatorShape["estimateForThread"] = (input: {
      readonly threadId: ThreadId;
      readonly projectId: ProjectId;
    }) =>
      Effect.gen(function* () {
        const readModel = yield* orchestrationEngine.getReadModel();
        const thread = readModel.threads.find((t) => t.id === input.threadId);

        if (!thread) {
          return {
            agentsMd: 0,
            projectContext: 0,
            resumeSummary: 0,
            skills: 0,
            userMessage: 0,
            totalRowlContext: 0,
            lastReportedTotal: null,
            contextWindowLimit: null,
            usagePercent: null,
          } satisfies ContextBudgetBreakdown;
        }

        const workspaceCwd = resolveThreadWorkspaceCwd(thread, readModel.projects);

        // ── Measure AGENTS.md ──
        let agentsMdTokens = 0;
        if (workspaceCwd) {
          try {
            const agentsFile = readProjectAgentsFile({
              cwd: workspaceCwd,
              includeContents: true,
            });
            if (agentsFile?.status === "available") {
              agentsMdTokens = estimateTokens(agentsFile.contents);
            }
          } catch {
            // AGENTS.md not found — no tokens
          }
        }

        // ── Measure project context ──
        let projectContextTokens = 0;
        try {
          const briefContents = workspaceCwd ? readProjectBriefFile(workspaceCwd) : null;
          projectContextTokens += estimateTokens(briefContents);

          const goalsResult = yield* goalsService
            .listGoalsByProject({ projectId: thread.projectId as ProjectId })
            .pipe(Effect.catch(() => Effect.succeed({ goals: [] as any[] })));
          for (const goal of goalsResult.goals) {
            projectContextTokens += estimateTokens((goal as any).text);
          }

          const featuresResult = yield* featureService
            .listFeaturesByProject({ projectId: thread.projectId as ProjectId })
            .pipe(Effect.catch(() => Effect.succeed({ features: [] as any[] })));
          for (const feature of featuresResult.features) {
            const f = feature as any;
            projectContextTokens += estimateTokens(f.name) + estimateTokens(f.description);
          }

          const threadGoal = (thread as any).goal;
          if (threadGoal && typeof threadGoal === "string") {
            projectContextTokens += estimateTokens(threadGoal);
          }

          // XML tag overhead (~50 tokens for all the wrapping tags)
          projectContextTokens += 50;
        } catch {
          // Project context assembly failed — 0 tokens
        }

        // ── Measure resume summary ──
        let resumeSummaryTokens = 0;
        try {
          const resumeContext = parseLatestResumeContext(thread.activities);
          if (resumeContext?.summary) {
            resumeSummaryTokens = estimateTokens(resumeContext.summary);
          }
        } catch {
          // No resume context
        }

        // ── Measure selected skills ──
        let skillsTokens = 0;
        // Skills are per-turn, not per-thread. We estimate based on last turn's skills
        // or what's available in the project
        try {
          const skillsActivity = thread.activities
            .filter((a: any) => a.kind === THREAD_SKILLS_ACTIVITY_KIND)
            .pop();
          if (skillsActivity) {
            const payload = (skillsActivity as any).payload;
            if (payload?.skills) {
              for (const skill of payload.skills) {
                skillsTokens += estimateTokens(skill.contents ?? skill.description ?? "");
              }
            }
          }
        } catch {
          // No skills data
        }

        // Last reported token usage comes from the client-side contextWindow module,
        // not from the server. The calculator only measures Rowl-controlled sections.
        const lastReportedTotal: number | null = null;

        const totalRowlContext =
          agentsMdTokens + projectContextTokens + resumeSummaryTokens + skillsTokens;

        const contextWindowLimit = guessContextWindowLimit(thread.model);
        const usagePercent =
          contextWindowLimit && lastReportedTotal
            ? Math.round((lastReportedTotal / contextWindowLimit) * 100)
            : null;

        return {
          agentsMd: agentsMdTokens,
          projectContext: projectContextTokens,
          resumeSummary: resumeSummaryTokens,
          skills: skillsTokens,
          userMessage: 0, // Can't predict next message
          totalRowlContext,
          lastReportedTotal,
          contextWindowLimit,
          usagePercent,
        } satisfies ContextBudgetBreakdown;
      }).pipe(
        Effect.catch(() =>
          Effect.succeed({
            agentsMd: 0,
            projectContext: 0,
            resumeSummary: 0,
            skills: 0,
            userMessage: 0,
            totalRowlContext: 0,
            lastReportedTotal: null,
            contextWindowLimit: null,
            usagePercent: null,
          } satisfies ContextBudgetBreakdown),
        ),
      );

    return { estimateForThread } satisfies ContextBudgetCalculatorShape;
  }),
);

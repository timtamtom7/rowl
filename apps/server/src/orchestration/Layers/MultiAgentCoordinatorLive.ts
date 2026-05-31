/**
 * MultiAgentCoordinatorLive — Multi-agent session management.
 *
 * Reads the orchestration read model to build an overview of all
 * active threads/agents in a project. Can spawn new agent threads
 * for specific features and detect file conflicts between agents.
 *
 * @module MultiAgentCoordinatorLive
 */
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { Effect, Layer } from "effect";
import {
  CommandId,
  DEFAULT_MODEL_BY_PROVIDER,
  type ProjectId,
  ThreadId,
  type ThreadId as ThreadIdType,
} from "@t3tools/contracts";

import {
  MultiAgentCoordinator,
  type MultiAgentCoordinatorShape,
  type AgentStatus,
  type MultiAgentOverview,
} from "../Services/MultiAgentCoordinator.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { GitCore } from "../../git/Services/GitCore.ts";

export const MultiAgentCoordinatorLive = Layer.effect(
  MultiAgentCoordinator,
  Effect.gen(function* () {
    const orchestrationEngine = yield* OrchestrationEngineService;
    const git = yield* GitCore;

    const getProjectAgentOverview: MultiAgentCoordinatorShape["getProjectAgentOverview"] = (
      input,
    ) =>
      Effect.gen(function* () {
        const readModel = yield* orchestrationEngine.getReadModel();
        const projectThreads = readModel.threads.filter(
          (t) =>
            t.projectId === input.projectId &&
            t.deletedAt === null &&
            !(t.title ?? "").startsWith("[Product Manager]") &&
            !(t.title ?? "").startsWith("[Skill Generator]"),
        );

        const agents: AgentStatus[] = projectThreads.map((thread) => {
          const t = thread as any;
          const session = t.session;
          let status: AgentStatus["status"] = "idle";
          if (session?.status === "running") status = "running";
          else if (session?.status === "error") status = "error";
          else if (t.turnDiffSummaries?.length > 0 && session?.status !== "running") {
            status = "completed";
          }

          return {
            threadId: t.id,
            threadTitle: t.title ?? "Untitled",
            featureName: t.goal ?? null,
            status,
            provider: session?.providerName ?? null,
            model: t.model ?? null,
            lastActivity: t.updatedAt ?? null,
            turnCount: t.messages?.filter((m: any) => m.role === "assistant").length ?? 0,
          };
        });

        const runningAgents = agents.filter((a) => a.status === "running").length;

        // Detect file conflicts from recent turn diffs
        const fileToThreads = new Map<string, Set<string>>();
        for (const thread of projectThreads) {
          const t = thread as any;
          const recentDiffs = (t.turnDiffSummaries ?? []).slice(-3);
          for (const diff of recentDiffs) {
            for (const file of diff.files ?? []) {
              const filePath = (file as any).path;
              if (!filePath) continue;
              if (!fileToThreads.has(filePath)) {
                fileToThreads.set(filePath, new Set());
              }
              fileToThreads.get(filePath)!.add(t.title ?? t.id);
            }
          }
        }

        const conflicts = [...fileToThreads.entries()]
          .filter(([, threads]) => threads.size > 1)
          .map(([filePath, threads]) => ({
            filePath,
            threads: [...threads],
          }));

        return {
          projectId: input.projectId,
          totalAgents: agents.length,
          runningAgents,
          agents,
          conflicts,
        } satisfies MultiAgentOverview;
      }).pipe(
        Effect.catch(() =>
          Effect.succeed({
            projectId: input.projectId,
            totalAgents: 0,
            runningAgents: 0,
            agents: [],
            conflicts: [],
          } satisfies MultiAgentOverview),
        ),
      );

    const spawnAgentForFeature: MultiAgentCoordinatorShape["spawnAgentForFeature"] = (input) =>
      Effect.gen(function* () {
        const readModel = yield* orchestrationEngine.getReadModel();
        const project = readModel.projects.find((p) => p.id === input.projectId);
        if (!project) {
          return yield* Effect.fail(new Error(`Project ${input.projectId} not found`));
        }

        const threadId = ThreadId.makeUnsafe(randomUUID());
        const now = new Date().toISOString();

        // Derive a safe branch name from the feature name
        const branchName =
          input.featureName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") + `-${Date.now().toString(36)}`;

        // Create a dedicated worktree for this agent so it can make
        // commits without conflicting with other agents or the main branch.
        const worktreesDir = join(dirname(project.workspaceRoot), "rowl-worktrees", project.title);
        const worktreePath = join(worktreesDir, branchName);

        // Try to create a worktree; fall back to main workspace on failure.
        const worktreeResult = yield* git
          .createWorktree({
            cwd: project.workspaceRoot,
            branch: "main",
            newBranch: branchName,
            path: worktreePath,
          })
          .pipe(
            Effect.map((r) => ({ branch: r.worktree.branch, path: r.worktree.path })),
            Effect.catch(() => Effect.succeed(null as { branch: string; path: string } | null)),
          );

        const resolvedWorktreePath = worktreeResult?.path ?? project.workspaceRoot;
        const resolvedBranch = worktreeResult?.branch ?? "main";

        // Create a thread for this feature
        yield* orchestrationEngine.dispatch({
          type: "thread.create",
          commandId: CommandId.makeUnsafe(randomUUID()),
          threadId,
          projectId: input.projectId,
          title: `Build: ${input.featureName}`,
          model: input.model ?? project?.defaultModel ?? DEFAULT_MODEL_BY_PROVIDER.codex,
          runtimeMode: "full-access",
          interactionMode: "default",
          branch: resolvedBranch,
          worktreePath: resolvedWorktreePath,
          createdAt: now,
        });

        // Send the initial instructions as the first turn
        yield* orchestrationEngine.dispatch({
          type: "thread.turn.start",
          commandId: CommandId.makeUnsafe(randomUUID()),
          threadId,
          message: {
            messageId: `msg:${randomUUID()}` as any,
            role: "user",
            text: input.instructions,
            attachments: [],
          },
          runtimeMode: "full-access",
          interactionMode: "default",
          createdAt: now,
        });

        return { threadId };
      }).pipe(
        Effect.catch((cause) =>
          Effect.fail(new Error(`Failed to spawn agent for feature: ${String(cause)}`)),
        ),
      ) as any;

    const detectConflicts: MultiAgentCoordinatorShape["detectConflicts"] = (input) =>
      getProjectAgentOverview(input).pipe(Effect.map((overview) => overview.conflicts));

    return {
      getProjectAgentOverview,
      spawnAgentForFeature,
      detectConflicts,
    } satisfies MultiAgentCoordinatorShape;
  }),
);

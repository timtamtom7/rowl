/**
 * ProjectPromptsService — CRUD for persistent AI instructions + harness activation.
 *
 * Three prompt scopes:
 * - global: applies to all projects (user preferences, coding style)
 * - project: applies to one project (tech stack, conventions)
 * - thread: applies to one thread (specific task instructions)
 *
 * Harness presets are pre-built workflow templates that can be activated per-thread.
 *
 * @module ProjectPromptsService
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

export interface ProjectPrompt {
  readonly id: string;
  readonly projectId: string | null;
  readonly threadId: string | null;
  readonly scope: "global" | "project" | "thread";
  readonly name: string;
  readonly content: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HarnessPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly content: string;
  readonly isBuiltin: boolean;
  readonly createdAt: string;
}

export interface ProjectPromptsServiceShape {
  // ── Prompts CRUD ──
  readonly createPrompt: (input: {
    projectId: ProjectId | null;
    threadId: ThreadId | null;
    scope: "global" | "project" | "thread";
    name: string;
    content: string;
  }) => Effect.Effect<ProjectPrompt>;

  readonly listPrompts: (input: {
    projectId?: ProjectId;
    scope?: "global" | "project" | "thread";
  }) => Effect.Effect<ReadonlyArray<ProjectPrompt>>;

  readonly updatePrompt: (input: {
    id: string;
    name?: string;
    content?: string;
    enabled?: boolean;
  }) => Effect.Effect<ProjectPrompt>;

  readonly deletePrompt: (input: { id: string }) => Effect.Effect<void>;

  // ── Harness Presets ──
  readonly listHarnessPresets: () => Effect.Effect<ReadonlyArray<HarnessPreset>>;

  readonly getActiveHarness: (input: {
    threadId: ThreadId;
  }) => Effect.Effect<HarnessPreset | null>;

  readonly activateHarness: (input: {
    threadId: ThreadId;
    presetId: string;
  }) => Effect.Effect<void>;

  readonly deactivateHarness: (input: {
    threadId: ThreadId;
  }) => Effect.Effect<void>;

  // ── Context Assembly ──
  /** Get all applicable prompts + active harness for a thread, ready for injection */
  readonly getContextForThread: (input: {
    projectId: ProjectId;
    threadId: ThreadId;
  }) => Effect.Effect<{
    prompts: ReadonlyArray<ProjectPrompt>;
    harnessContent: string | null;
  }>;
}

export class ProjectPromptsService extends ServiceMap.Service<
  ProjectPromptsService,
  ProjectPromptsServiceShape
>()("rowl/orchestration/Services/ProjectPromptsService") {}

/**
 * CodebaseIntelligence — Service for persistent codebase health analysis.
 *
 * Studies codebases across sessions. Assigns health scores to files.
 * Surfaces issues proactively before they become problems.
 * Inspired by Valo's "Codebase Intelligence (Pro)" feature.
 *
 * Health factors:
 * - File size (>500 lines = unhealthy)
 * - Connection count (highly connected = risky to change)
 * - Change frequency (frequently changed = volatile)
 * - Isolation (no connections = potentially dead code)
 *
 * @module CodebaseIntelligence
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectId } from "@t3tools/contracts";

export interface FileHealthEntry {
  readonly filePath: string;
  readonly lineCount: number;
  readonly connectionCount: number;
  readonly changeFrequency: number;
  readonly healthScore: number; // 0-100, higher = healthier
  readonly issues: ReadonlyArray<string>;
  readonly lastChangedAt: string | null;
}

export interface CodebaseHealthSummary {
  readonly projectId: ProjectId;
  readonly totalFiles: number;
  readonly averageHealth: number;
  readonly criticalFiles: ReadonlyArray<FileHealthEntry>; // health < 40
  readonly warningFiles: ReadonlyArray<FileHealthEntry>; // health 40-70
  readonly healthyFiles: number;
}

export interface CodebaseIntelligenceShape {
  /** Update health scores for all files in a project (called after dependency graph scan) */
  readonly updateProjectHealth: (input: {
    readonly projectId: ProjectId;
    readonly files: ReadonlyArray<{
      filePath: string;
      lineCount: number;
      connectionCount: number;
    }>;
  }) => Effect.Effect<void>;

  /** Record a file change event (increments change frequency) */
  readonly recordFileChange: (input: {
    readonly projectId: ProjectId;
    readonly filePath: string;
  }) => Effect.Effect<void>;

  /** Get health summary for a project */
  readonly getProjectHealthSummary: (input: {
    readonly projectId: ProjectId;
  }) => Effect.Effect<CodebaseHealthSummary>;

  /** Get health details for a specific file */
  readonly getFileHealth: (input: {
    readonly projectId: ProjectId;
    readonly filePath: string;
  }) => Effect.Effect<FileHealthEntry | null>;
}

export class CodebaseIntelligence extends ServiceMap.Service<
  CodebaseIntelligence,
  CodebaseIntelligenceShape
>()("rowl/orchestration/Services/CodebaseIntelligence") {}

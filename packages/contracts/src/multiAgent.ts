import { Schema } from "effect";
import { NonNegativeInt, ProjectId, ThreadId, TrimmedNonEmptyString } from "./baseSchemas";

export const AgentStatus = Schema.Struct({
  threadId: ThreadId,
  threadTitle: Schema.String,
  featureName: Schema.NullOr(Schema.String),
  status: Schema.Literals(["idle", "running", "completed", "error"]),
  provider: Schema.NullOr(Schema.String),
  model: Schema.NullOr(Schema.String),
  lastActivity: Schema.NullOr(Schema.String),
  turnCount: NonNegativeInt,
});
export type AgentStatus = typeof AgentStatus.Type;

export const FileConflict = Schema.Struct({
  filePath: Schema.String,
  threads: Schema.Array(Schema.String),
});
export type FileConflict = typeof FileConflict.Type;

export const MultiAgentOverview = Schema.Struct({
  projectId: ProjectId,
  totalAgents: NonNegativeInt,
  runningAgents: NonNegativeInt,
  agents: Schema.Array(AgentStatus),
  conflicts: Schema.Array(FileConflict),
});
export type MultiAgentOverview = typeof MultiAgentOverview.Type;

// ── Get overview ──
export const GetAgentOverviewInput = Schema.Struct({
  projectId: ProjectId,
});
export type GetAgentOverviewInput = typeof GetAgentOverviewInput.Type;

export const GetAgentOverviewResult = Schema.Struct({
  overview: MultiAgentOverview,
});
export type GetAgentOverviewResult = typeof GetAgentOverviewResult.Type;

// ── Spawn agent ──
export const SpawnAgentForFeatureInput = Schema.Struct({
  projectId: ProjectId,
  featureName: TrimmedNonEmptyString,
  instructions: TrimmedNonEmptyString,
  model: Schema.optional(Schema.String),
});
export type SpawnAgentForFeatureInput = typeof SpawnAgentForFeatureInput.Type;

export const SpawnAgentForFeatureResult = Schema.Struct({
  threadId: ThreadId,
});
export type SpawnAgentForFeatureResult = typeof SpawnAgentForFeatureResult.Type;

// ── Detect conflicts ──
export const DetectConflictsInput = Schema.Struct({
  projectId: ProjectId,
});
export type DetectConflictsInput = typeof DetectConflictsInput.Type;

export const DetectConflictsResult = Schema.Struct({
  conflicts: Schema.Array(FileConflict),
});
export type DetectConflictsResult = typeof DetectConflictsResult.Type;

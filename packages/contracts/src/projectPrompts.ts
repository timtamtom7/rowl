import { Schema } from "effect";
import { ProjectId, ThreadId, TrimmedNonEmptyString } from "./baseSchemas";

export const PromptScope = Schema.Literals(["global", "project", "thread"]);
export type PromptScope = typeof PromptScope.Type;

export const ProjectPrompt = Schema.Struct({
  id: Schema.String,
  projectId: Schema.NullOr(ProjectId),
  threadId: Schema.NullOr(ThreadId),
  scope: PromptScope,
  name: Schema.String,
  content: Schema.String,
  enabled: Schema.Boolean,
  priority: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type ProjectPrompt = typeof ProjectPrompt.Type;

export const HarnessPreset = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  category: Schema.String,
  content: Schema.String,
  isBuiltin: Schema.Boolean,
  createdAt: Schema.String,
});
export type HarnessPreset = typeof HarnessPreset.Type;

// ── List prompts ──
export const ListPromptsInput = Schema.Struct({
  projectId: Schema.optional(ProjectId),
  scope: Schema.optional(PromptScope),
});
export type ListPromptsInput = typeof ListPromptsInput.Type;

export const ListPromptsResult = Schema.Struct({
  prompts: Schema.Array(ProjectPrompt),
});
export type ListPromptsResult = typeof ListPromptsResult.Type;

// ── Create prompt ──
export const CreatePromptInput = Schema.Struct({
  projectId: Schema.NullOr(ProjectId),
  threadId: Schema.NullOr(ThreadId),
  scope: PromptScope,
  name: TrimmedNonEmptyString,
  content: Schema.String,
});
export type CreatePromptInput = typeof CreatePromptInput.Type;

export const CreatePromptResult = Schema.Struct({
  prompt: ProjectPrompt,
});
export type CreatePromptResult = typeof CreatePromptResult.Type;

// ── Update prompt ──
export const UpdatePromptInput = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: Schema.optional(Schema.String),
  content: Schema.optional(Schema.String),
  enabled: Schema.optional(Schema.Boolean),
});
export type UpdatePromptInput = typeof UpdatePromptInput.Type;

export const UpdatePromptResult = Schema.Struct({
  prompt: ProjectPrompt,
});
export type UpdatePromptResult = typeof UpdatePromptResult.Type;

// ── Delete prompt ──
export const DeletePromptInput = Schema.Struct({
  id: TrimmedNonEmptyString,
});
export type DeletePromptInput = typeof DeletePromptInput.Type;

export const DeletePromptResult = Schema.Struct({});
export type DeletePromptResult = typeof DeletePromptResult.Type;

// ── Harness presets ──
export const ListHarnessPresetsResult = Schema.Struct({
  presets: Schema.Array(HarnessPreset),
});
export type ListHarnessPresetsResult = typeof ListHarnessPresetsResult.Type;

// ── Activate harness ──
export const ActivateHarnessInput = Schema.Struct({
  threadId: ThreadId,
  presetId: TrimmedNonEmptyString,
});
export type ActivateHarnessInput = typeof ActivateHarnessInput.Type;

export const ActivateHarnessResult = Schema.Struct({});
export type ActivateHarnessResult = typeof ActivateHarnessResult.Type;

// ── Deactivate harness ──
export const DeactivateHarnessInput = Schema.Struct({
  threadId: ThreadId,
});
export type DeactivateHarnessInput = typeof DeactivateHarnessInput.Type;

export const DeactivateHarnessResult = Schema.Struct({});
export type DeactivateHarnessResult = typeof DeactivateHarnessResult.Type;

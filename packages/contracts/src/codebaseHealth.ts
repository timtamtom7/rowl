import { Schema } from "effect";
import { NonNegativeInt, ProjectId, TrimmedNonEmptyString } from "./baseSchemas";

export const FileHealthEntry = Schema.Struct({
  filePath: Schema.String,
  lineCount: NonNegativeInt,
  connectionCount: NonNegativeInt,
  changeFrequency: NonNegativeInt,
  healthScore: NonNegativeInt,
  issues: Schema.Array(Schema.String),
  lastChangedAt: Schema.NullOr(Schema.String),
});
export type FileHealthEntry = typeof FileHealthEntry.Type;

export const CodebaseHealthSummary = Schema.Struct({
  projectId: ProjectId,
  totalFiles: NonNegativeInt,
  averageHealth: NonNegativeInt,
  criticalFiles: Schema.Array(FileHealthEntry),
  warningFiles: Schema.Array(FileHealthEntry),
  healthyFiles: NonNegativeInt,
});
export type CodebaseHealthSummary = typeof CodebaseHealthSummary.Type;

export const GetCodebaseHealthInput = Schema.Struct({
  projectId: ProjectId,
});
export type GetCodebaseHealthInput = typeof GetCodebaseHealthInput.Type;

export const GetCodebaseHealthResult = Schema.Struct({
  summary: CodebaseHealthSummary,
});
export type GetCodebaseHealthResult = typeof GetCodebaseHealthResult.Type;

export const UpdateCodebaseHealthInput = Schema.Struct({
  projectId: ProjectId,
  files: Schema.Array(
    Schema.Struct({
      filePath: Schema.String,
      lineCount: NonNegativeInt,
      connectionCount: NonNegativeInt,
    }),
  ),
});
export type UpdateCodebaseHealthInput = typeof UpdateCodebaseHealthInput.Type;

export const UpdateCodebaseHealthResult = Schema.Struct({});
export type UpdateCodebaseHealthResult = typeof UpdateCodebaseHealthResult.Type;

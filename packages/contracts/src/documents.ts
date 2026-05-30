import { Schema } from "effect";

import { GoalId } from "./goals";
import { IsoDateTime, PositiveInt, TrimmedNonEmptyString } from "./baseSchemas";

export const GoalDocumentId = TrimmedNonEmptyString.check(
  Schema.isMaxLength(128),
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
).pipe(Schema.brand("GoalDocumentId"));
export type GoalDocumentId = typeof GoalDocumentId.Type;

export const GoalDocument = Schema.Struct({
  id: GoalDocumentId,
  goalId: GoalId,
  title: TrimmedNonEmptyString,
  content: Schema.String,
  version: PositiveInt,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type GoalDocument = typeof GoalDocument.Type;

export const CreateGoalDocumentInput = Schema.Struct({
  goalId: GoalId,
  title: TrimmedNonEmptyString,
  content: Schema.String,
});
export type CreateGoalDocumentInput = typeof CreateGoalDocumentInput.Type;

export const UpdateGoalDocumentInput = Schema.Struct({
  goalId: GoalId,
  documentId: GoalDocumentId,
  title: Schema.optional(TrimmedNonEmptyString),
  content: Schema.optional(Schema.String),
});
export type UpdateGoalDocumentInput = typeof UpdateGoalDocumentInput.Type;

export const WriteGoalDocumentInput = Schema.Struct({
  goalId: GoalId,
  documentId: Schema.optional(GoalDocumentId),
  title: TrimmedNonEmptyString,
  content: Schema.String,
});
export type WriteGoalDocumentInput = typeof WriteGoalDocumentInput.Type;

export const ReadGoalDocumentInput = Schema.Struct({
  goalId: GoalId,
  documentId: GoalDocumentId,
  version: Schema.optional(PositiveInt),
});
export type ReadGoalDocumentInput = typeof ReadGoalDocumentInput.Type;

export const DeleteGoalDocumentInput = Schema.Struct({
  goalId: GoalId,
  documentId: GoalDocumentId,
});
export type DeleteGoalDocumentInput = typeof DeleteGoalDocumentInput.Type;

export const GoalDocumentResult = Schema.Struct({
  document: GoalDocument,
});
export type GoalDocumentResult = typeof GoalDocumentResult.Type;

export const DeleteGoalDocumentResult = Schema.Struct({});
export type DeleteGoalDocumentResult = typeof DeleteGoalDocumentResult.Type;

export const ListDocumentsByGoalInput = Schema.Struct({
  goalId: GoalId,
});
export type ListDocumentsByGoalInput = typeof ListDocumentsByGoalInput.Type;

export const ListDocumentsByGoalResult = Schema.Struct({
  documents: Schema.Array(GoalDocument),
});
export type ListDocumentsByGoalResult = typeof ListDocumentsByGoalResult.Type;

import { Schema } from "effect";
import {
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas";

export const MemoryEntryType = Schema.Literals([
  "decision",
  "preference",
  "fact",
  "context",
  "architecture",
]);
export type MemoryEntryType = typeof MemoryEntryType.Type;

export const MemoryEntry = Schema.Struct({
  id: TrimmedNonEmptyString,
  projectId: Schema.NullOr(ProjectId),
  threadId: Schema.NullOr(ThreadId),
  type: MemoryEntryType,
  content: Schema.String,
  summary: Schema.String,
  importance: Schema.Number,
  createdAt: IsoDateTime,
  lastAccessedAt: Schema.NullOr(IsoDateTime),
});
export type MemoryEntry = typeof MemoryEntry.Type;

// ── Create ──
export const CreateMemoryInput = Schema.Struct({
  projectId: Schema.NullOr(ProjectId),
  threadId: Schema.NullOr(ThreadId),
  type: MemoryEntryType,
  content: Schema.String,
  summary: TrimmedNonEmptyString,
  importance: Schema.optional(Schema.Number),
});
export type CreateMemoryInput = typeof CreateMemoryInput.Type;

export const CreateMemoryResult = Schema.Struct({
  memory: MemoryEntry,
});
export type CreateMemoryResult = typeof CreateMemoryResult.Type;

// ── Search ──
export const SearchMemoryInput = Schema.Struct({
  query: TrimmedNonEmptyString,
  projectId: Schema.optional(ProjectId),
  limit: Schema.optional(NonNegativeInt),
});
export type SearchMemoryInput = typeof SearchMemoryInput.Type;

export const SearchMemoryResult = Schema.Struct({
  memories: Schema.Array(MemoryEntry),
});
export type SearchMemoryResult = typeof SearchMemoryResult.Type;

// ── List by project ──
export const ListMemoryByProjectInput = Schema.Struct({
  projectId: ProjectId,
  limit: Schema.optional(NonNegativeInt),
});
export type ListMemoryByProjectInput = typeof ListMemoryByProjectInput.Type;

export const ListMemoryByProjectResult = Schema.Struct({
  memories: Schema.Array(MemoryEntry),
});
export type ListMemoryByProjectResult = typeof ListMemoryByProjectResult.Type;

// ── Delete ──
export const DeleteMemoryInput = Schema.Struct({
  id: TrimmedNonEmptyString,
});
export type DeleteMemoryInput = typeof DeleteMemoryInput.Type;

export const DeleteMemoryResult = Schema.Struct({});
export type DeleteMemoryResult = typeof DeleteMemoryResult.Type;

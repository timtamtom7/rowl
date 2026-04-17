import { IsoDateTime, ProjectId, ThreadId } from "@t3tools/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const MemoryEntryId = Schema.String.pipe(Schema.brand("MemoryEntryId"));
export type MemoryEntryId = typeof MemoryEntryId.Type;

export const MemoryEntryType = Schema.Literals([
  "decision",
  "preference",
  "fact",
  "context",
  "architecture",
]);
export type MemoryEntryType = typeof MemoryEntryType.Type;

export const MemoryEntry = Schema.Struct({
  id: MemoryEntryId,
  projectId: Schema.NullOr(ProjectId),
  threadId: Schema.NullOr(ThreadId),
  type: MemoryEntryType,
  content: Schema.String,
  summary: Schema.String,
  importance: Schema.Number,
  createdAt: IsoDateTime,
  lastAccessedAt: Schema.NullOr(IsoDateTime),
  sourceEventSequence: Schema.NullOr(Schema.Number),
});
export type MemoryEntry = typeof MemoryEntry.Type;

export const SearchMemoryInput = Schema.Struct({
  query: Schema.String,
  projectId: Schema.optional(ProjectId),
  limit: Schema.optional(Schema.Number),
});
export type SearchMemoryInput = typeof SearchMemoryInput.Type;

export const CreateMemoryInput = Schema.Struct({
  projectId: Schema.NullOr(ProjectId),
  threadId: Schema.NullOr(ThreadId),
  type: MemoryEntryType,
  content: Schema.String,
  summary: Schema.String,
  importance: Schema.optional(Schema.Number),
});
export type CreateMemoryInput = typeof CreateMemoryInput.Type;

export const DeleteMemoryInput = Schema.Struct({
  id: MemoryEntryId,
});
export type DeleteMemoryInput = typeof DeleteMemoryInput.Type;

export const ListMemoryByProjectInput = Schema.Struct({
  projectId: ProjectId,
  limit: Schema.optional(Schema.Number),
});
export type ListMemoryByProjectInput = typeof ListMemoryByProjectInput.Type;

export interface MemoryEntryRepositoryShape {
  readonly upsert: (entry: MemoryEntry) => Effect.Effect<void, ProjectionRepositoryError>;

  readonly search: (
    input: SearchMemoryInput,
  ) => Effect.Effect<ReadonlyArray<MemoryEntry>, ProjectionRepositoryError>;

  readonly listByProject: (
    input: ListMemoryByProjectInput,
  ) => Effect.Effect<ReadonlyArray<MemoryEntry>, ProjectionRepositoryError>;

  readonly deleteById: (
    input: DeleteMemoryInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;

  readonly touchAccessed: (
    id: MemoryEntryId,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

export class MemoryEntryRepository extends ServiceMap.Service<
  MemoryEntryRepository,
  MemoryEntryRepositoryShape
>()("rowl/persistence/Services/MemoryEntries/MemoryEntryRepository") {}

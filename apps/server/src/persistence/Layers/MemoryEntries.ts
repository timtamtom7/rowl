/**
 * MemoryEntryRepositoryLive — SQLite persistence for deep memory entries.
 *
 * Uses FTS5 for full-text search across memory content and summaries.
 * FTS5 is kept in sync via SQLite triggers defined in migration 020.
 *
 * @module MemoryEntryRepositoryLive
 */
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Schema } from "effect";

import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";

import {
  type DeleteMemoryInput,
  type ListMemoryByProjectInput,
  MemoryEntry,
  type MemoryEntryId,
  MemoryEntryRepository,
  type MemoryEntryRepositoryShape,
  type SearchMemoryInput,
} from "../Services/MemoryEntries.ts";

function toPersistenceSqlOrDecodeError(sqlOp: string, decodeOp: string) {
  return (cause: unknown) =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOp)(cause)
      : toPersistenceSqlError(sqlOp)(cause);
}

const selectColumns = `
  id,
  project_id AS "projectId",
  thread_id AS "threadId",
  type,
  content,
  summary,
  importance,
  created_at AS "createdAt",
  last_accessed_at AS "lastAccessedAt",
  source_event_sequence AS "sourceEventSequence"
`;

const makeRepo = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: MemoryEntry,
    execute: (row) =>
      sql`
        INSERT INTO memory_entries (
          id, project_id, thread_id, type, content, summary,
          importance, created_at, last_accessed_at, source_event_sequence
        ) VALUES (
          ${row.id}, ${row.projectId}, ${row.threadId}, ${row.type},
          ${row.content}, ${row.summary}, ${row.importance},
          ${row.createdAt}, ${row.lastAccessedAt}, ${row.sourceEventSequence}
        )
        ON CONFLICT (id)
        DO UPDATE SET
          content = excluded.content,
          summary = excluded.summary,
          importance = excluded.importance,
          last_accessed_at = excluded.last_accessed_at
      `,
  });

  const upsert: MemoryEntryRepositoryShape["upsert"] = (entry) =>
    upsertRow(entry).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "MemoryEntryRepository.upsert:query",
          "MemoryEntryRepository.upsert:encodeRequest",
        ),
      ),
    );

  const search: MemoryEntryRepositoryShape["search"] = (input: SearchMemoryInput) =>
    Effect.gen(function* () {
      const limit = input.limit ?? 10;
      const rawQuery = input.query.trim();
      if (!rawQuery) return [] as any[];
      // Sanitize for FTS5: strip special characters that have meaning in FTS5 syntax
      const query = rawQuery
        .replace(/['"(){}[\]*^~]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!query) return [] as any[];

      // FTS5 search with ranking
      const projectFilter = input.projectId
        ? sql`AND m.project_id = ${input.projectId}`
        : sql``;

      const rows = yield* sql`
        SELECT
          m.id,
          m.project_id AS "projectId",
          m.thread_id AS "threadId",
          m.type,
          m.content,
          m.summary,
          m.importance,
          m.created_at AS "createdAt",
          m.last_accessed_at AS "lastAccessedAt",
          m.source_event_sequence AS "sourceEventSequence"
        FROM memory_entries m
        INNER JOIN memory_fts f ON m.rowid = f.rowid
        WHERE memory_fts MATCH ${query}
        ${projectFilter}
        ORDER BY rank
        LIMIT ${limit}
      `.pipe(Effect.mapError(toPersistenceSqlError("MemoryEntryRepository.search:query")));

      return rows as any;
    }) as any;

  const listByProject: MemoryEntryRepositoryShape["listByProject"] = (
    input: ListMemoryByProjectInput,
  ) =>
    sql`
      SELECT ${sql.unsafe(selectColumns)}
      FROM memory_entries
      WHERE project_id = ${input.projectId}
      ORDER BY importance DESC, created_at DESC
      LIMIT ${input.limit ?? 50}
    `.pipe(
      Effect.map((rows) => rows as any),
      Effect.mapError(toPersistenceSqlError("MemoryEntryRepository.listByProject:query")),
    ) as any;

  const deleteById: MemoryEntryRepositoryShape["deleteById"] = (input: DeleteMemoryInput) =>
    sql`DELETE FROM memory_entries WHERE id = ${input.id}`.pipe(
      Effect.asVoid,
      Effect.mapError(toPersistenceSqlError("MemoryEntryRepository.deleteById:query")),
    );

  const touchAccessed: MemoryEntryRepositoryShape["touchAccessed"] = (id: MemoryEntryId) =>
    sql`
      UPDATE memory_entries
      SET last_accessed_at = ${new Date().toISOString()}
      WHERE id = ${id}
    `.pipe(
      Effect.asVoid,
      Effect.mapError(toPersistenceSqlError("MemoryEntryRepository.touchAccessed:query")),
    );

  return {
    upsert,
    search,
    listByProject,
    deleteById,
    touchAccessed,
  } satisfies MemoryEntryRepositoryShape;
});

export const MemoryEntryRepositoryLive = Layer.effect(MemoryEntryRepository, makeRepo);

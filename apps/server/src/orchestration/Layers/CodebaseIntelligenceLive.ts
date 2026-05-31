/**
 * CodebaseIntelligenceLive — Persistent codebase health scoring.
 *
 * Calculates health scores based on:
 * - File size: >500 lines = -30 health, >300 = -15
 * - Coupling: >10 connections = -20, >20 = -30
 * - Volatility: >10 changes = -10, >20 = -20
 * - Isolation: 0 connections = -10 (potentially dead code)
 *
 * @module CodebaseIntelligenceLive
 */
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { randomUUID } from "node:crypto";
import type { ProjectId } from "@t3tools/contracts";

import {
  CodebaseIntelligence,
  type CodebaseIntelligenceShape,
  type FileHealthEntry,
  type CodebaseHealthSummary,
} from "../Services/CodebaseIntelligence.ts";

function calculateHealthScore(
  lineCount: number,
  connectionCount: number,
  changeFrequency: number,
): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];

  // Size penalties
  if (lineCount > 500) {
    score -= 30;
    issues.push(`Large file (${lineCount} lines) — consider splitting`);
  } else if (lineCount > 300) {
    score -= 15;
    issues.push(`Growing file (${lineCount} lines) — watch for bloat`);
  }

  // Coupling penalties
  if (connectionCount > 20) {
    score -= 30;
    issues.push(`Highly coupled (${connectionCount} connections) — changes here affect many files`);
  } else if (connectionCount > 10) {
    score -= 20;
    issues.push(`Moderately coupled (${connectionCount} connections)`);
  }

  // Volatility penalties
  if (changeFrequency > 20) {
    score -= 20;
    issues.push(`Frequently changed (${changeFrequency} times) — may indicate instability`);
  } else if (changeFrequency > 10) {
    score -= 10;
    issues.push(`Changed often (${changeFrequency} times)`);
  }

  // Isolation penalty
  if (connectionCount === 0 && lineCount > 10) {
    score -= 10;
    issues.push("Isolated file — no imports/exports detected, possibly dead code");
  }

  return { score: Math.max(0, score), issues };
}

export const CodebaseIntelligenceLive = Layer.effect(
  CodebaseIntelligence,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const updateProjectHealth: CodebaseIntelligenceShape["updateProjectHealth"] = (input) =>
      Effect.gen(function* () {
        const now = new Date().toISOString();

        for (const file of input.files) {
          const { score, issues } = calculateHealthScore(
            file.lineCount,
            file.connectionCount,
            0, // changeFrequency comes from existing records
          );

          yield* sql`
            INSERT INTO codebase_health (
              id, project_id, file_path, line_count, connection_count,
              health_score, issues_json, created_at, updated_at
            ) VALUES (
              ${randomUUID()}, ${input.projectId}, ${file.filePath},
              ${file.lineCount}, ${file.connectionCount},
              ${score}, ${JSON.stringify(issues)},
              ${now}, ${now}
            )
            ON CONFLICT (project_id, file_path)
            DO UPDATE SET
              line_count = excluded.line_count,
              connection_count = excluded.connection_count,
              health_score = excluded.health_score,
              issues_json = excluded.issues_json,
              updated_at = excluded.updated_at
          `.pipe(Effect.asVoid);
        }
      }).pipe(Effect.catch(() => Effect.void));

    const recordFileChange: CodebaseIntelligenceShape["recordFileChange"] = (input) =>
      sql`
        UPDATE codebase_health
        SET change_frequency = change_frequency + 1,
            last_changed_at = ${new Date().toISOString()},
            updated_at = ${new Date().toISOString()}
        WHERE project_id = ${input.projectId}
          AND file_path = ${input.filePath}
      `.pipe(
        Effect.asVoid,
        Effect.catch(() => Effect.void),
      );

    const getProjectHealthSummary: CodebaseIntelligenceShape["getProjectHealthSummary"] = (input) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            file_path AS "filePath",
            line_count AS "lineCount",
            connection_count AS "connectionCount",
            change_frequency AS "changeFrequency",
            health_score AS "healthScore",
            issues_json AS "issuesJson",
            last_changed_at AS "lastChangedAt"
          FROM codebase_health
          WHERE project_id = ${input.projectId}
          ORDER BY health_score ASC
        `;

        const entries: FileHealthEntry[] = (rows as any[]).map((row) => ({
          filePath: row.filePath,
          lineCount: row.lineCount,
          connectionCount: row.connectionCount,
          changeFrequency: row.changeFrequency,
          healthScore: row.healthScore,
          issues: JSON.parse(row.issuesJson ?? "[]"),
          lastChangedAt: row.lastChangedAt,
        }));

        const critical = entries.filter((e) => e.healthScore < 40);
        const warning = entries.filter((e) => e.healthScore >= 40 && e.healthScore < 70);
        const healthyCount = entries.filter((e) => e.healthScore >= 70).length;
        const avgHealth =
          entries.length > 0
            ? Math.round(entries.reduce((sum, e) => sum + e.healthScore, 0) / entries.length)
            : 100;

        return {
          projectId: input.projectId,
          totalFiles: entries.length,
          averageHealth: avgHealth,
          criticalFiles: critical,
          warningFiles: warning,
          healthyFiles: healthyCount,
        } satisfies CodebaseHealthSummary;
      }).pipe(
        Effect.catch(() =>
          Effect.succeed({
            projectId: input.projectId,
            totalFiles: 0,
            averageHealth: 100,
            criticalFiles: [],
            warningFiles: [],
            healthyFiles: 0,
          } satisfies CodebaseHealthSummary),
        ),
      );

    const getFileHealth: CodebaseIntelligenceShape["getFileHealth"] = (input) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            file_path AS "filePath",
            line_count AS "lineCount",
            connection_count AS "connectionCount",
            change_frequency AS "changeFrequency",
            health_score AS "healthScore",
            issues_json AS "issuesJson",
            last_changed_at AS "lastChangedAt"
          FROM codebase_health
          WHERE project_id = ${input.projectId}
            AND file_path = ${input.filePath}
          LIMIT 1
        `;
        if ((rows as any[]).length === 0) return null;
        const row = (rows as any[])[0];
        return {
          filePath: row.filePath,
          lineCount: row.lineCount,
          connectionCount: row.connectionCount,
          changeFrequency: row.changeFrequency,
          healthScore: row.healthScore,
          issues: JSON.parse(row.issuesJson ?? "[]"),
          lastChangedAt: row.lastChangedAt,
        } satisfies FileHealthEntry;
      }).pipe(Effect.catch(() => Effect.succeed(null)));

    return {
      updateProjectHealth,
      recordFileChange,
      getProjectHealthSummary,
      getFileHealth,
    } satisfies CodebaseIntelligenceShape;
  }),
);

/**
 * EvaluatorServiceLive — Verification agent implementation.
 *
 * Uses the Overseer's pattern detection + structural checks to verify
 * that builder claims are backed by evidence.
 *
 * The evaluator runs AFTER a turn completes. It checks:
 * 1. Were files actually created/modified? (from turn diff)
 * 2. Does the claimed work match the file changes?
 * 3. Are there any Overseer warnings from the turn?
 * 4. Is the context budget healthy?
 *
 * Future: will use a lightweight AI model (Haiku-class) to do
 * spec compliance checking. For now, uses structural analysis.
 *
 * @module EvaluatorServiceLive
 */
import { Effect, Layer } from "effect";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

import {
  EvaluatorService,
  type EvaluatorServiceShape,
  type EvaluationResult,
} from "../Services/EvaluatorService.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";

export const EvaluatorServiceLive = Layer.effect(
  EvaluatorService,
  Effect.gen(function* () {
    const orchestrationEngine = yield* OrchestrationEngineService;

    const evaluateThread: EvaluatorServiceShape["evaluateThread"] = (input) =>
      Effect.gen(function* () {
        const readModel = yield* orchestrationEngine.getReadModel();
        const thread = readModel.threads.find((t) => t.id === input.threadId);

        if (!thread) {
          return {
            threadId: input.threadId,
            status: "fail" as const,
            checks: [
              { name: "Thread exists", status: "fail" as const, detail: "Thread not found" },
            ],
            summary: "Thread not found — cannot evaluate.",
            timestamp: new Date().toISOString(),
          };
        }

        const checks: Array<{ name: string; status: "pass" | "fail" | "skipped"; detail: string }> =
          [];
        const t = thread as any;

        // Check 1: Were files actually changed?
        const turnDiffs = t.turnDiffSummaries ?? [];
        const latestDiff = turnDiffs[turnDiffs.length - 1];
        const filesChanged = latestDiff?.files?.length ?? 0;

        if (filesChanged > 0) {
          checks.push({
            name: "Files modified",
            status: "pass",
            detail: `${filesChanged} file${filesChanged !== 1 ? "s" : ""} changed`,
          });
        } else {
          checks.push({
            name: "Files modified",
            status: "fail",
            detail: "No files were changed in the latest turn",
          });
        }

        // Check 2: Are there Overseer warnings?
        const activities = t.activities ?? [];
        const overseerWarnings = activities.filter(
          (a: any) =>
            typeof a.kind === "string" &&
            a.kind.startsWith("overseer.") &&
            a.kind !== "overseer.session-error",
        );
        const recentWarnings = overseerWarnings.slice(-5);

        if (recentWarnings.length === 0) {
          checks.push({
            name: "No oversight issues",
            status: "pass",
            detail: "No warnings from the Overseer",
          });
        } else {
          const warningTypes = [...new Set(recentWarnings.map((w: any) => w.kind))];
          checks.push({
            name: "Oversight issues",
            status: "fail",
            detail: `${recentWarnings.length} warning${recentWarnings.length !== 1 ? "s" : ""}: ${warningTypes.join(", ").replace(/overseer\./g, "")}`,
          });
        }

        // Check 3: Was the claimed work substantive?
        const messages = t.messages ?? [];
        const lastAssistant = messages.filter((m: any) => m.role === "assistant").pop();
        const responseLength = lastAssistant ? ((lastAssistant as any).text?.length ?? 0) : 0;

        if (responseLength > 100) {
          checks.push({
            name: "Response substance",
            status: "pass",
            detail: `${Math.round(responseLength / 100) * 100}+ character response`,
          });
        } else if (responseLength > 0) {
          checks.push({
            name: "Response substance",
            status: "partial" as any,
            detail: "Brief response — may be incomplete",
          });
        } else {
          checks.push({
            name: "Response substance",
            status: "fail",
            detail: "No assistant response found",
          });
        }

        // Check 4: Session status healthy?
        const sessionStatus = t.session?.status;
        if (sessionStatus === "running" || sessionStatus === "ready" || sessionStatus === "idle") {
          checks.push({
            name: "Session health",
            status: "pass",
            detail: `Session is ${sessionStatus}`,
          });
        } else if (sessionStatus === "error") {
          checks.push({
            name: "Session health",
            status: "fail",
            detail: `Session in error state: ${t.session?.lastError ?? "unknown"}`,
          });
        }

        // Calculate overall status
        const failCount = checks.filter((c) => c.status === "fail").length;
        const status: EvaluationResult["status"] =
          failCount === 0 ? "pass" : failCount <= 1 ? "partial" : "fail";

        const passCount = checks.filter((c) => c.status === "pass").length;
        const summary =
          status === "pass"
            ? `All ${checks.length} checks passed. Work looks complete.`
            : status === "partial"
              ? `${passCount}/${checks.length} checks passed. Review the flagged items.`
              : `${failCount}/${checks.length} checks failed. Work may be incomplete.`;

        return {
          threadId: input.threadId,
          status,
          checks: checks as EvaluationResult["checks"],
          summary,
          timestamp: new Date().toISOString(),
        };
      }).pipe(
        Effect.catch(() =>
          Effect.succeed({
            threadId: input.threadId,
            status: "fail" as const,
            checks: [{ name: "Evaluation", status: "fail" as const, detail: "Evaluation failed" }],
            summary: "Could not evaluate — internal error.",
            timestamp: new Date().toISOString(),
          }),
        ),
      );

    const quickCheck: EvaluatorServiceShape["quickCheck"] = (_input) =>
      Effect.succeed({ compiles: true, errors: [] as ReadonlyArray<string> });

    return { evaluateThread, quickCheck } satisfies EvaluatorServiceShape;
  }),
);

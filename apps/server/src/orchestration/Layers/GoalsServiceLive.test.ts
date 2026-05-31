import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Effect, Layer, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectId } from "@t3tools/contracts";

import { ServerConfig } from "../../config.ts";
import {
  ProjectionGoalRepository,
  type ProjectionGoal,
  type ProjectionGoalRepositoryShape,
} from "../../persistence/Services/ProjectionGoals.ts";
import { GoalsService } from "../Services/GoalsService.ts";
import { GoalsServiceLive } from "./GoalsServiceLive.ts";

let stateDir: string;
let rows: Map<string, ProjectionGoal>;

beforeEach(async () => {
  stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-goals-state-"));
  rows = new Map();
});

afterEach(async () => {
  await fs.rm(stateDir, { recursive: true, force: true });
});

function repositoryLayer() {
  const repo: ProjectionGoalRepositoryShape = {
    upsert: (row) =>
      Effect.sync(() => {
        rows.set(row.goalId, structuredClone(row) as ProjectionGoal);
      }),
    getById: ({ goalId }) =>
      Effect.sync(() => {
        const row = rows.get(goalId);
        return row ? Option.some(structuredClone(row) as ProjectionGoal) : Option.none();
      }),
    listByProjectId: ({ projectId }) =>
      Effect.sync(() =>
        [...rows.values()]
          .filter((row) => row.projectId === projectId)
          .sort(
            (a, b) => Number(b.isMain) - Number(a.isMain) || a.createdAt.localeCompare(b.createdAt),
          ),
      ),
    deleteById: ({ goalId }) =>
      Effect.sync(() => {
        rows.delete(goalId);
      }),
    clearMainGoalForProject: ({ projectId, exceptGoalId }) =>
      Effect.sync(() => {
        for (const row of rows.values()) {
          if (row.projectId === projectId && row.goalId !== exceptGoalId) {
            rows.set(row.goalId, { ...row, isMain: false });
          }
        }
      }),
  };
  return Layer.succeed(ProjectionGoalRepository, repo);
}

function configLayer() {
  return Layer.succeed(ServerConfig, {
    cwd: "/tmp/rowl",
    stateDir,
    mode: "web" as const,
    autoBootstrapProjectFromCwd: false,
    logWebSocketEvents: false,
    port: 0,
    host: undefined,
    authToken: undefined,
    keybindingsConfigPath: path.join(stateDir, "keybindings.json"),
    staticDir: undefined,
    devUrl: undefined,
    noBrowser: true,
  });
}

function runWithGoals<T, E>(effect: Effect.Effect<T, E, GoalsService>): Promise<T> {
  const layer = GoalsServiceLive.pipe(
    Layer.provide(repositoryLayer()),
    Layer.provide(configLayer()),
  );
  return Effect.runPromise(effect.pipe(Effect.provide(layer)));
}

describe("GoalsServiceLive hierarchy", () => {
  it("creates hierarchical goals and walks children and ancestors", async () => {
    const result = await runWithGoals(
      Effect.gen(function* () {
        const goals = yield* GoalsService;
        const parent = yield* goals.createGoal({
          projectId: ProjectId.makeUnsafe("project-1"),
          text: "Company objective",
          isMain: true,
          status: "planned",
          level: "company",
        });
        const child = yield* goals.createGoal({
          projectId: ProjectId.makeUnsafe("project-1"),
          text: "Agent task",
          isMain: false,
          parentId: parent.goal.id,
          status: "active",
          level: "agent",
          ownerAgentId: "agent-1",
          description: "Build the organizing layer",
        });

        const children = yield* goals.getGoalChildren({ parentId: parent.goal.id });
        const ancestors = yield* goals.getGoalAncestors({ id: child.goal.id });
        return { parent, child, children, ancestors };
      }),
    );

    expect(result.parent.goal.level).toBe("company");
    expect(result.child.goal.parentId).toBe(result.parent.goal.id);
    expect(result.children.goals.map((goal) => goal.id)).toEqual([result.child.goal.id]);
    expect(result.ancestors.goals.map((goal) => goal.id)).toEqual([result.parent.goal.id]);

    const raw = await fs.readFile(
      path.join(stateDir, "goals", result.child.goal.id, "metadata.json"),
      "utf8",
    );
    expect(raw).toContain('"ownerAgentId": "agent-1"');
  });

  it("updates goal metadata while preserving legacy fields", async () => {
    const result = await runWithGoals(
      Effect.gen(function* () {
        const goals = yield* GoalsService;
        const created = yield* goals.createGoal({
          projectId: ProjectId.makeUnsafe("project-1"),
          text: "Draft plan",
          isMain: false,
          status: "planned",
          level: "task",
        });
        return yield* goals.updateGoal({
          id: created.goal.id,
          text: "Draft accepted plan",
          status: "achieved",
          parentId: null,
          description: "Ready to ship",
        });
      }),
    );

    expect(result.goal.text).toBe("Draft accepted plan");
    expect(result.goal.status).toBe("achieved");
    expect(result.goal.description).toBe("Ready to ship");
    expect(rows.get(result.goal.id)?.text).toBe("Draft accepted plan");
  });
});

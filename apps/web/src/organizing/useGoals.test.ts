import { describe, expect, it, vi } from "vitest";
import type { NativeApi } from "@t3tools/contracts";
import { GoalId, ProjectId } from "@t3tools/contracts";

import { createGoalActions } from "./useGoals";

const NOW = "2026-05-30T12:00:00.000Z";
const projectId = ProjectId.makeUnsafe("project-1");
const goalId = GoalId.makeUnsafe("goal-1");

const goal = {
  id: goalId,
  projectId,
  text: "Ship organizing layer",
  isMain: true,
  linkedThreadIds: [],
  status: "active" as const,
  level: "team" as const,
  createdAt: NOW,
};

describe("createGoalActions", () => {
  it("maps goal CRUD calls to the NativeApi goals surface", async () => {
    const api = {
      goals: {
        listByProject: vi.fn(async () => ({ goals: [goal] })),
        create: vi.fn(async () => ({ goal })),
        update: vi.fn(async () => ({ goal: { ...goal, status: "achieved" as const } })),
        getChildren: vi.fn(async () => ({ goals: [{ ...goal, id: GoalId.makeUnsafe("child") }] })),
        getAncestors: vi.fn(async () => ({ goals: [goal] })),
      },
    } as unknown as NativeApi;

    const actions = createGoalActions({ api, projectId });

    await expect(actions.listByProject()).resolves.toEqual([goal]);
    await actions.create({ text: "Ship organizing layer", isMain: true });
    await actions.update({ id: goalId, status: "achieved" });
    await actions.getChildren(goalId);
    await actions.getAncestors(goalId);

    expect(api.goals.listByProject).toHaveBeenCalledWith({ projectId });
    expect(api.goals.create).toHaveBeenCalledWith({
      projectId,
      text: "Ship organizing layer",
      isMain: true,
    });
    expect(api.goals.update).toHaveBeenCalledWith({ id: goalId, status: "achieved" });
    expect(api.goals.getChildren).toHaveBeenCalledWith({ parentId: goalId });
    expect(api.goals.getAncestors).toHaveBeenCalledWith({ id: goalId });
  });
});

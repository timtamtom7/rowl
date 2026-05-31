import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { Goal, UpdateGoalInput } from "./goals";

const decodeGoal = Schema.decodeUnknownEffect(Goal);
const decodeUpdateGoalInput = Schema.decodeUnknownEffect(UpdateGoalInput);

it.effect("decodes legacy goals with default organizing fields", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeGoal({
      id: "goal-1",
      projectId: "project-1",
      text: "Ship organizing layer",
      isMain: true,
      linkedThreadIds: [],
      createdAt: "2026-05-30T12:00:00.000Z",
    });

    assert.strictEqual(parsed.status, "active");
    assert.strictEqual(parsed.level, "task");
  }),
);

it.effect("decodes hierarchical goal fields", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeGoal({
      id: "goal-child",
      projectId: "project-1",
      text: "Draft approval model",
      isMain: false,
      linkedThreadIds: ["thread-1"],
      parentId: "goal-parent",
      status: "planned",
      level: "agent",
      ownerAgentId: "agent-1",
      description: "Paperclip-style organizing layer",
      createdAt: "2026-05-30T12:00:00.000Z",
    });

    assert.strictEqual(parsed.parentId, "goal-parent");
    assert.strictEqual(parsed.status, "planned");
    assert.strictEqual(parsed.level, "agent");
  }),
);

it.effect("accepts update inputs that clear optional hierarchy fields", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeUpdateGoalInput({
      id: "goal-child",
      parentId: null,
      ownerAgentId: null,
      description: null,
      status: "achieved",
    });

    assert.strictEqual(parsed.parentId, null);
    assert.strictEqual(parsed.ownerAgentId, null);
    assert.strictEqual(parsed.description, null);
    assert.strictEqual(parsed.status, "achieved");
  }),
);

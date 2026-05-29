import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { ORCHESTRATION_WS_CHANNELS, ORCHESTRATION_WS_METHODS } from "./orchestration";
import { WebSocketRequest, WsResponse, WS_CHANNELS, WS_METHODS } from "./ws";

const decodeWebSocketRequest = Schema.decodeUnknownEffect(WebSocketRequest);
const decodeWsResponse = Schema.decodeUnknownEffect(WsResponse);

it.effect("accepts getTurnDiff requests when fromTurnCount <= toTurnCount", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeWebSocketRequest({
      id: "req-1",
      body: {
        _tag: ORCHESTRATION_WS_METHODS.getTurnDiff,
        threadId: "thread-1",
        fromTurnCount: 1,
        toTurnCount: 2,
      },
    });
    assert.strictEqual(parsed.body._tag, ORCHESTRATION_WS_METHODS.getTurnDiff);
  }),
);

it.effect("rejects getTurnDiff requests when fromTurnCount > toTurnCount", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(
      decodeWebSocketRequest({
        id: "req-1",
        body: {
          _tag: ORCHESTRATION_WS_METHODS.getTurnDiff,
          threadId: "thread-1",
          fromTurnCount: 3,
          toTurnCount: 2,
        },
      }),
    );
    assert.strictEqual(result._tag, "Failure");
  }),
);

it.effect("trims websocket request id and nested orchestration ids", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeWebSocketRequest({
      id: " req-1 ",
      body: {
        _tag: ORCHESTRATION_WS_METHODS.getTurnDiff,
        threadId: " thread-1 ",
        fromTurnCount: 0,
        toTurnCount: 0,
      },
    });
    assert.strictEqual(parsed.id, "req-1");
    assert.strictEqual(parsed.body._tag, ORCHESTRATION_WS_METHODS.getTurnDiff);
    if (parsed.body._tag === ORCHESTRATION_WS_METHODS.getTurnDiff) {
      assert.strictEqual(parsed.body.threadId, "thread-1");
    }
  }),
);

it.effect("accepts git.preparePullRequestThread requests", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeWebSocketRequest({
      id: "req-pr-1",
      body: {
        _tag: WS_METHODS.gitPreparePullRequestThread,
        cwd: "/repo",
        reference: "#42",
        mode: "worktree",
      },
    });
    assert.strictEqual(parsed.body._tag, WS_METHODS.gitPreparePullRequestThread);
  }),
);

it.effect("accepts core-agent websocket requests", () =>
  Effect.gen(function* () {
    const list = yield* decodeWebSocketRequest({
      id: "req-core-agents-list",
      body: {
        _tag: WS_METHODS.coreAgentsList,
        scope: { type: "global" },
      },
    });
    assert.strictEqual(list.body._tag, WS_METHODS.coreAgentsList);

    const create = yield* decodeWebSocketRequest({
      id: "req-core-agents-create",
      body: {
        _tag: WS_METHODS.coreAgentsCreate,
        name: "Planner",
        scope: { type: "project", projectRoot: "/tmp/project" },
        personality: {
          kind: "preset",
          presetId: "planner",
          instructions: "Plan before editing.",
        },
      },
    });
    assert.strictEqual(create.body._tag, WS_METHODS.coreAgentsCreate);

    const update = yield* decodeWebSocketRequest({
      id: "req-core-agents-update",
      body: {
        _tag: WS_METHODS.coreAgentsUpdate,
        agentId: "agent-1",
        scope: { type: "global" },
        name: "Reviewer",
      },
    });
    assert.strictEqual(update.body._tag, WS_METHODS.coreAgentsUpdate);

    const remove = yield* decodeWebSocketRequest({
      id: "req-core-agents-delete",
      body: {
        _tag: WS_METHODS.coreAgentsDelete,
        agentId: "agent-1",
        scope: { type: "global" },
      },
    });
    assert.strictEqual(remove.body._tag, WS_METHODS.coreAgentsDelete);

    const setActive = yield* decodeWebSocketRequest({
      id: "req-core-agents-set-active",
      body: {
        _tag: WS_METHODS.coreAgentsSetActive,
        agentId: "agent-1",
        scope: { type: "global" },
      },
    });
    assert.strictEqual(setActive.body._tag, WS_METHODS.coreAgentsSetActive);
  }),
);

it.effect("rejects core-agent websocket requests with unsafe agent ids", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(
      decodeWebSocketRequest({
        id: "req-core-agents-delete",
        body: {
          _tag: WS_METHODS.coreAgentsDelete,
          agentId: "../agent",
          scope: { type: "global" },
        },
      }),
    );
    assert.strictEqual(result._tag, "Failure");
  }),
);

it.effect("accepts typed websocket push envelopes with sequence", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeWsResponse({
      type: "push",
      sequence: 1,
      channel: WS_CHANNELS.serverWelcome,
      data: {
        cwd: "/tmp/workspace",
        projectName: "workspace",
      },
    });

    if (!("type" in parsed) || parsed.type !== "push") {
      assert.fail("expected websocket response to decode as a push envelope");
    }

    assert.strictEqual(parsed.type, "push");
    assert.strictEqual(parsed.sequence, 1);
    assert.strictEqual(parsed.channel, WS_CHANNELS.serverWelcome);
  }),
);

it.effect("accepts core-agent active-changed push envelopes", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeWsResponse({
      type: "push",
      sequence: 3,
      channel: WS_CHANNELS.coreAgentActiveChanged,
      data: {
        scope: { type: "global" },
        activeAgentId: "agent-1",
        agent: {
          id: "agent-1",
          name: "Rowl",
          scope: { type: "global" },
          personality: {
            kind: "preset",
            presetId: "rowl-default",
            instructions: "Be direct and maintain project memory.",
          },
          createdAt: "2026-05-29T12:00:00.000Z",
          updatedAt: "2026-05-29T12:00:00.000Z",
        },
      },
    });

    if (!("type" in parsed) || parsed.type !== "push") {
      assert.fail("expected websocket response to decode as a push envelope");
    }

    assert.strictEqual(parsed.channel, WS_CHANNELS.coreAgentActiveChanged);
  }),
);

it.effect("rejects push envelopes when channel payload does not match the channel schema", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(
      decodeWsResponse({
        type: "push",
        sequence: 2,
        channel: ORCHESTRATION_WS_CHANNELS.domainEvent,
        data: {
          cwd: "/tmp/workspace",
          projectName: "workspace",
        },
      }),
    );

    assert.strictEqual(result._tag, "Failure");
  }),
);

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

it.effect("accepts managed worktree and git integration requests", () =>
  Effect.gen(function* () {
    const create = yield* decodeWebSocketRequest({
      id: "req-worktree-create",
      body: {
        _tag: WS_METHODS.worktreesCreate,
        cwd: "/repo",
        branch: "agent/feature-auth",
        baseBranch: "main",
      },
    });
    assert.strictEqual(create.body._tag, WS_METHODS.worktreesCreate);

    const list = yield* decodeWebSocketRequest({
      id: "req-worktree-list",
      body: {
        _tag: WS_METHODS.worktreesList,
        cwd: "/repo",
      },
    });
    assert.strictEqual(list.body._tag, WS_METHODS.worktreesList);

    const cherryPick = yield* decodeWebSocketRequest({
      id: "req-git-cherry-pick",
      body: {
        _tag: WS_METHODS.gitCherryPick,
        cwd: "/repo",
        sourceRef: "agent/feature-auth",
        targetBranch: "main",
      },
    });
    assert.strictEqual(cherryPick.body._tag, WS_METHODS.gitCherryPick);

    const createCheckpoint = yield* decodeWebSocketRequest({
      id: "req-checkpoint-worktree-create",
      body: {
        _tag: WS_METHODS.checkpointsCreateInWorktree,
        cwd: "/repo",
        worktreeBranch: "agent/feature-auth",
        message: "checkpoint",
      },
    });
    assert.strictEqual(createCheckpoint.body._tag, WS_METHODS.checkpointsCreateInWorktree);

    const listCheckpoints = yield* decodeWebSocketRequest({
      id: "req-checkpoint-worktree-list",
      body: {
        _tag: WS_METHODS.checkpointsListByWorktree,
        cwd: "/repo",
        worktreeBranch: "agent/feature-auth",
      },
    });
    assert.strictEqual(listCheckpoints.body._tag, WS_METHODS.checkpointsListByWorktree);

    const stackBranch = yield* decodeWebSocketRequest({
      id: "req-git-stack-branch",
      body: {
        _tag: WS_METHODS.gitStackBranch,
        cwd: "/repo",
        branch: "agent/stacked",
      },
    });
    assert.strictEqual(stackBranch.body._tag, WS_METHODS.gitStackBranch);

    const diffTree = yield* decodeWebSocketRequest({
      id: "req-git-diff-tree",
      body: {
        _tag: WS_METHODS.gitGetDiffTree,
        cwd: "/repo",
        fromRef: "main",
        toRef: "HEAD",
      },
    });
    assert.strictEqual(diffTree.body._tag, WS_METHODS.gitGetDiffTree);
  }),
);

it.effect("accepts thread approval gate websocket requests", () =>
  Effect.gen(function* () {
    const create = yield* decodeWebSocketRequest({
      id: "req-approval-gate-create",
      body: {
        _tag: WS_METHODS.approvalGatesCreate,
        threadId: "thread-1",
        turnId: "turn-1",
        type: "file-change",
        description: "Approve file edit",
        proposedChange: {
          files: [{ path: "README.md", status: "modified", diff: "@@ changed" }],
        },
      },
    });
    assert.strictEqual(create.body._tag, WS_METHODS.approvalGatesCreate);

    const list = yield* decodeWebSocketRequest({
      id: "req-approval-gate-list",
      body: {
        _tag: WS_METHODS.approvalGatesList,
        threadId: "thread-1",
      },
    });
    assert.strictEqual(list.body._tag, WS_METHODS.approvalGatesList);

    const approve = yield* decodeWebSocketRequest({
      id: "req-approval-gate-approve",
      body: {
        _tag: WS_METHODS.approvalGatesApprove,
        id: "gate-1",
      },
    });
    assert.strictEqual(approve.body._tag, WS_METHODS.approvalGatesApprove);
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

it.effect("accepts memory note websocket requests", () =>
  Effect.gen(function* () {
    const list = yield* decodeWebSocketRequest({
      id: "req-memory-notes-list",
      body: {
        _tag: WS_METHODS.memoryNotesList,
        scope: { type: "global" },
        agentId: "agent-1",
      },
    });
    assert.strictEqual(list.body._tag, WS_METHODS.memoryNotesList);

    const read = yield* decodeWebSocketRequest({
      id: "req-memory-notes-read",
      body: {
        _tag: WS_METHODS.memoryNotesRead,
        scope: { type: "global" },
        agentId: "agent-1",
        filename: "api-contracts",
      },
    });
    assert.strictEqual(read.body._tag, WS_METHODS.memoryNotesRead);

    const write = yield* decodeWebSocketRequest({
      id: "req-memory-notes-write",
      body: {
        _tag: WS_METHODS.memoryNotesWrite,
        scope: { type: "project", projectRoot: "/repo" },
        agentId: "agent-project",
        filename: "architecture",
        title: "Architecture",
        tags: ["project"],
        content: "# Architecture",
      },
    });
    assert.strictEqual(write.body._tag, WS_METHODS.memoryNotesWrite);

    const remove = yield* decodeWebSocketRequest({
      id: "req-memory-notes-delete",
      body: {
        _tag: WS_METHODS.memoryNotesDelete,
        scope: { type: "global" },
        agentId: "agent-1",
        filename: "api-contracts",
      },
    });
    assert.strictEqual(remove.body._tag, WS_METHODS.memoryNotesDelete);
  }),
);

it.effect("accepts context meter websocket requests and responses", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeWebSocketRequest({
      id: "req-context-meter",
      body: {
        _tag: WS_METHODS.contextMeterGet,
        threadId: "thread-1",
      },
    });
    assert.strictEqual(parsed.body._tag, WS_METHODS.contextMeterGet);

    const response = yield* decodeWsResponse({
      id: "req-context-meter",
      result: {
        snapshot: {
          threadId: "thread-1",
          model: "gpt-5-codex",
          contextWindowTokens: 400_000,
          usedTokens: 280_000,
          percentUsed: 70,
          level: "warning",
          warningThresholdPercent: 70,
          criticalThresholdPercent: 90,
          updatedAt: "2026-05-30T00:00:00.000Z",
          history: [
            {
              turnId: "turn-1",
              provider: "codex",
              model: "gpt-5-codex",
              usedTokens: 280_000,
              contextWindowTokens: 400_000,
              percentUsed: 70,
              level: "warning",
              observedAt: "2026-05-30T00:00:00.000Z",
            },
          ],
        },
      },
    });
    assert.strictEqual("id" in response ? response.id : null, "req-context-meter");
  }),
);

it.effect("accepts organizing-layer websocket requests", () =>
  Effect.gen(function* () {
    const updateGoal = yield* decodeWebSocketRequest({
      id: "req-goal-update",
      body: {
        _tag: WS_METHODS.goalsUpdate,
        id: "goal-1",
        parentId: "goal-parent",
        status: "active",
        level: "agent",
      },
    });
    assert.strictEqual(updateGoal.body._tag, WS_METHODS.goalsUpdate);

    const listDocuments = yield* decodeWebSocketRequest({
      id: "req-documents-list",
      body: {
        _tag: WS_METHODS.documentsList,
        goalId: "goal-1",
      },
    });
    assert.strictEqual(listDocuments.body._tag, WS_METHODS.documentsList);

    const writeDocument = yield* decodeWebSocketRequest({
      id: "req-documents-write",
      body: {
        _tag: WS_METHODS.documentsWrite,
        goalId: "goal-1",
        documentId: "doc-1",
        title: "Research",
        content: "# Research",
      },
    });
    assert.strictEqual(writeDocument.body._tag, WS_METHODS.documentsWrite);

    const createApproval = yield* decodeWebSocketRequest({
      id: "req-approvals-create",
      body: {
        _tag: WS_METHODS.approvalsCreate,
        goalId: "goal-1",
        documentId: "doc-1",
        requestedBy: "agent-1",
      },
    });
    assert.strictEqual(createApproval.body._tag, WS_METHODS.approvalsCreate);

    const approve = yield* decodeWebSocketRequest({
      id: "req-approvals-approve",
      body: {
        _tag: WS_METHODS.approvalsApprove,
        goalId: "goal-1",
        approvalId: "approval-1",
        reviewedBy: "mauriello",
      },
    });
    assert.strictEqual(approve.body._tag, WS_METHODS.approvalsApprove);
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

it.effect("accepts memory-changed push envelopes", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeWsResponse({
      type: "push",
      sequence: 4,
      channel: WS_CHANNELS.memoryChanged,
      data: {
        scope: { type: "global" },
        agentId: "agent-1",
        filename: "api-contracts",
        operation: "updated",
      },
    });

    if (!("type" in parsed) || parsed.type !== "push") {
      assert.fail("expected websocket response to decode as a push envelope");
    }

    assert.strictEqual(parsed.channel, WS_CHANNELS.memoryChanged);
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

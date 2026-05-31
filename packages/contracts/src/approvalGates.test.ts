import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  CreateThreadApprovalGateInput,
  ThreadApprovalGate,
  ThreadApprovalGateIdInput,
} from "./approvalGates";

const decodeGate = Schema.decodeUnknownEffect(ThreadApprovalGate);
const decodeCreateGateInput = Schema.decodeUnknownEffect(CreateThreadApprovalGateInput);
const decodeGateIdInput = Schema.decodeUnknownEffect(ThreadApprovalGateIdInput);

it.effect("decodes thread-turn approval gates", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeGate({
      id: "gate-1",
      threadId: "thread-1",
      turnId: "turn-1",
      type: "file-change",
      description: "Approve file edit",
      proposedChange: {
        summary: "Update README",
        files: [{ path: "README.md", status: "modified", diff: "@@ changed" }],
      },
      status: "pending",
      createdAt: "2026-05-30T12:00:00.000Z",
    });

    assert.strictEqual(parsed.type, "file-change");
    assert.strictEqual(parsed.proposedChange.files?.[0]?.path, "README.md");
  }),
);

it.effect("decodes create and id inputs", () =>
  Effect.gen(function* () {
    const create = yield* decodeCreateGateInput({
      threadId: "thread-1",
      turnId: "turn-1",
      type: "shell-command",
      description: "Run migration",
      proposedChange: { command: "bun run migrate", cwd: "/repo" },
    });
    const idInput = yield* decodeGateIdInput({ id: "gate-1" });

    assert.strictEqual(create.proposedChange.command, "bun run migrate");
    assert.strictEqual(idInput.id, "gate-1");
  }),
);

it.effect("rejects invalid gate type", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(
      decodeCreateGateInput({
        threadId: "thread-1",
        turnId: "turn-1",
        type: "network",
        description: "Open socket",
        proposedChange: {},
      }),
    );

    assert.strictEqual(result._tag, "Failure");
  }),
);

import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { GoalDocument, ReadGoalDocumentInput, WriteGoalDocumentInput } from "./documents";

const decodeDocument = Schema.decodeUnknownEffect(GoalDocument);
const decodeReadInput = Schema.decodeUnknownEffect(ReadGoalDocumentInput);
const decodeWriteInput = Schema.decodeUnknownEffect(WriteGoalDocumentInput);

it.effect("decodes goal documents", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeDocument({
      id: "doc-1",
      goalId: "goal-1",
      title: "Research",
      content: "# Research\n\nFindings",
      version: 1,
      createdAt: "2026-05-30T12:00:00.000Z",
      updatedAt: "2026-05-30T12:00:00.000Z",
    });

    assert.strictEqual(parsed.version, 1);
    assert.strictEqual(parsed.goalId, "goal-1");
  }),
);

it.effect("rejects invalid document ids", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(
      decodeDocument({
        id: "../doc",
        goalId: "goal-1",
        title: "Research",
        content: "",
        version: 1,
        createdAt: "2026-05-30T12:00:00.000Z",
        updatedAt: "2026-05-30T12:00:00.000Z",
      }),
    );

    assert.strictEqual(result._tag, "Failure");
  }),
);

it.effect("decodes read and write document inputs", () =>
  Effect.gen(function* () {
    const read = yield* decodeReadInput({
      goalId: "goal-1",
      documentId: "doc-1",
      version: 2,
    });
    const write = yield* decodeWriteInput({
      goalId: "goal-1",
      documentId: "doc-1",
      title: "Research v2",
      content: "# Research v2",
    });

    assert.strictEqual(read.version, 2);
    assert.strictEqual(write.documentId, "doc-1");
  }),
);

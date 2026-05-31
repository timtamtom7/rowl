import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { GoalDocumentId, GoalId } from "@t3tools/contracts";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDocumentService } from "./DocumentServiceLive.ts";

const NOW = "2026-05-30T12:00:00.000Z";
const LATER = "2026-05-30T12:10:00.000Z";

let stateDir: string;
let timestamps: string[];

beforeEach(async () => {
  stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-documents-state-"));
  timestamps = [NOW, LATER];
});

afterEach(async () => {
  await fs.rm(stateDir, { recursive: true, force: true });
});

function service() {
  return createDocumentService({
    stateDir,
    generateId: () => "doc-1",
    now: () => timestamps.shift() ?? LATER,
  });
}

describe("DocumentService", () => {
  it("creates, lists, updates, and reads document versions", async () => {
    const documents = service();

    const created = await Effect.runPromise(
      documents.createDocument({
        goalId: GoalId.makeUnsafe("goal-1"),
        title: "Research",
        content: "# Research\n\nInitial findings",
      }),
    );
    expect(created.document.version).toBe(1);

    const updated = await Effect.runPromise(
      documents.updateDocument({
        goalId: GoalId.makeUnsafe("goal-1"),
        documentId: GoalDocumentId.makeUnsafe("doc-1"),
        content: "# Research\n\nUpdated findings",
      }),
    );
    expect(updated.document.version).toBe(2);

    const v1 = await Effect.runPromise(
      documents.readDocument({
        goalId: GoalId.makeUnsafe("goal-1"),
        documentId: GoalDocumentId.makeUnsafe("doc-1"),
        version: 1,
      }),
    );
    expect(v1.document.content).toContain("Initial findings");

    const current = await Effect.runPromise(
      documents.readDocument({
        goalId: GoalId.makeUnsafe("goal-1"),
        documentId: GoalDocumentId.makeUnsafe("doc-1"),
      }),
    );
    expect(current.document.content).toContain("Updated findings");

    const list = await Effect.runPromise(
      documents.listDocumentsByGoal({ goalId: GoalId.makeUnsafe("goal-1") }),
    );
    expect(list.documents.map((document) => [document.id, document.version])).toEqual([
      ["doc-1", 2],
    ]);

    await expect(
      fs.readFile(
        path.join(stateDir, "goals", "goal-1", "documents", "versions", "doc-1.v1.md"),
        "utf8",
      ),
    ).resolves.toContain("Initial findings");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { NativeApi } from "@t3tools/contracts";
import { GoalDocumentId, GoalId } from "@t3tools/contracts";

import { createDocumentActions } from "./useDocuments";

const NOW = "2026-05-30T12:00:00.000Z";
const goalId = GoalId.makeUnsafe("goal-1");
const documentId = GoalDocumentId.makeUnsafe("research");

const document = {
  id: documentId,
  goalId,
  title: "Research",
  content: "# Research",
  version: 2,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("createDocumentActions", () => {
  it("maps document CRUD and version reads to the NativeApi documents surface", async () => {
    const api = {
      documents: {
        listByGoal: vi.fn(async () => ({ documents: [document] })),
        read: vi.fn(async () => ({ document })),
        write: vi.fn(async () => ({ document: { ...document, version: 3 } })),
        create: vi.fn(async () => ({ document })),
        update: vi.fn(async () => ({ document: { ...document, title: "Updated" } })),
        delete: vi.fn(async () => ({})),
      },
    } as unknown as NativeApi;

    const actions = createDocumentActions({ api, goalId });

    await expect(actions.listByGoal()).resolves.toEqual([document]);
    await actions.read({ documentId, version: 1 });
    await actions.write({ documentId, title: "Research", content: "# Updated" });
    await actions.create({ title: "Research", content: "# Research" });
    await actions.update({ documentId, title: "Updated" });
    await actions.delete(documentId);

    expect(api.documents.listByGoal).toHaveBeenCalledWith({ goalId });
    expect(api.documents.read).toHaveBeenCalledWith({ goalId, documentId, version: 1 });
    expect(api.documents.write).toHaveBeenCalledWith({
      goalId,
      documentId,
      title: "Research",
      content: "# Updated",
    });
    expect(api.documents.delete).toHaveBeenCalledWith({ goalId, documentId });
  });
});

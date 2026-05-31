import { ThreadId } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  COMPOSER_DRAFT_MAX_BYTES,
  COMPOSER_DRAFT_SAVE_DEBOUNCE_MS,
  COMPOSER_TEXT_DRAFTS_STORAGE_KEY,
  clearPersistedDraft,
  createDraftPersistenceController,
  restorePersistedDraft,
  savePersistedDraft,
} from "./useDraftPersistence";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    snapshot: () => Object.fromEntries(values.entries()),
  };
}

describe("draft persistence", () => {
  const threadId = ThreadId.makeUnsafe("thread-a");
  const otherThreadId = ThreadId.makeUnsafe("thread-b");

  it("saves, restores, and clears draft text per thread", () => {
    const storage = createMemoryStorage();

    savePersistedDraft(threadId, "draft one", { storage });
    savePersistedDraft(otherThreadId, "draft two", { storage });

    expect(restorePersistedDraft(threadId, { storage })).toBe("draft one");
    expect(restorePersistedDraft(otherThreadId, { storage })).toBe("draft two");

    clearPersistedDraft(threadId, { storage });

    expect(restorePersistedDraft(threadId, { storage })).toBe("");
    expect(restorePersistedDraft(otherThreadId, { storage })).toBe("draft two");
  });

  it("debounces draft writes and keeps only the latest text", () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();
    const controller = createDraftPersistenceController({ storage });

    controller.saveDraft(threadId, "first");
    controller.saveDraft(threadId, "second");

    expect(storage.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(COMPOSER_DRAFT_SAVE_DEBOUNCE_MS - 1);
    expect(storage.setItem).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(restorePersistedDraft(threadId, { storage })).toBe("second");
    expect(storage.setItem).toHaveBeenCalledTimes(2);
  });

  it("flushes a pending debounced save immediately", () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();
    const controller = createDraftPersistenceController({ storage });

    controller.saveDraft(threadId, "pending");
    controller.flush();

    expect(restorePersistedDraft(threadId, { storage })).toBe("pending");
    vi.advanceTimersByTime(COMPOSER_DRAFT_SAVE_DEBOUNCE_MS);
    expect(restorePersistedDraft(threadId, { storage })).toBe("pending");
  });

  it("does not persist drafts larger than the 50KB limit", () => {
    const storage = createMemoryStorage();
    const exactlyMax = "a".repeat(COMPOSER_DRAFT_MAX_BYTES);
    const tooLarge = "a".repeat(COMPOSER_DRAFT_MAX_BYTES + 1);

    savePersistedDraft(threadId, exactlyMax, { storage });
    expect(restorePersistedDraft(threadId, { storage })).toBe(exactlyMax);

    savePersistedDraft(threadId, tooLarge, { storage });

    expect(restorePersistedDraft(threadId, { storage })).toBe("");
  });

  it("migrates prompt text from legacy composer draft storage", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "rowl:composer-drafts:v1",
      JSON.stringify({
        state: {
          draftsByThreadId: {
            [threadId]: {
              prompt: "legacy rowl draft",
              attachments: [],
            },
            [otherThreadId]: {
              prompt: "",
              attachments: [],
            },
          },
        },
        version: 1,
      }),
    );

    expect(restorePersistedDraft(threadId, { storage })).toBe("legacy rowl draft");

    const migrated = JSON.parse(storage.snapshot()[COMPOSER_TEXT_DRAFTS_STORAGE_KEY] ?? "{}") as {
      draftsByThreadId?: Record<string, string>;
    };
    expect(migrated.draftsByThreadId?.[threadId]).toBe("legacy rowl draft");
    expect(migrated.draftsByThreadId?.[otherThreadId]).toBeUndefined();
  });

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

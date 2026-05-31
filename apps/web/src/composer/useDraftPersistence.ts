import { useCallback, useEffect, useRef } from "react";
import { ThreadId } from "@t3tools/contracts";

export const COMPOSER_TEXT_DRAFTS_STORAGE_KEY = "rowl:composer-text-drafts:v1";
export const COMPOSER_DRAFT_SAVE_DEBOUNCE_MS = 500;
export const COMPOSER_DRAFT_MAX_BYTES = 50 * 1024;

const LEGACY_COMPOSER_DRAFT_STORAGE_KEYS = [
  "rowl:composer-drafts:v1",
  "t3code:composer-drafts:v1",
] as const;

interface ComposerTextDraftStorageState {
  version: 1;
  draftsByThreadId: Record<string, string>;
}

interface DraftStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface DraftPersistenceOptions {
  storage?: DraftStorage;
  debounceMs?: number;
  maxBytes?: number;
}

interface DraftPersistenceController {
  restoreDraft: (threadId: ThreadId) => string;
  saveDraft: (threadId: ThreadId, text: string) => void;
  clearDraft: (threadId: ThreadId) => void;
  flush: () => void;
  dispose: () => void;
}

interface UseDraftPersistenceInput {
  threadId: ThreadId;
  text: string;
  onRestoreDraft: (text: string) => void;
  storage?: DraftStorage;
}

function resolveBrowserStorage(): DraftStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function textSizeBytes(text: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text).byteLength;
  }
  return new Blob([text]).size;
}

function normalizeDraftText(value: unknown, maxBytes: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (value.length === 0 || textSizeBytes(value) > maxBytes) {
    return null;
  }
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isPlainRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractDraftPrompt(value: unknown, maxBytes: number): string | null {
  const direct = normalizeDraftText(value, maxBytes);
  if (direct !== null) {
    return direct;
  }
  if (!isPlainRecord(value)) {
    return null;
  }
  return normalizeDraftText(value.prompt, maxBytes);
}

function collectDraftsFromMap(rawDrafts: unknown, maxBytes: number): Record<string, string> {
  if (!isPlainRecord(rawDrafts)) {
    return {};
  }
  const drafts: Record<string, string> = {};
  for (const [threadId, rawDraft] of Object.entries(rawDrafts)) {
    if (threadId.length === 0) {
      continue;
    }
    const prompt = extractDraftPrompt(rawDraft, maxBytes);
    if (prompt !== null) {
      drafts[threadId] = prompt;
    }
  }
  return drafts;
}

function normalizeTextDraftStorageState(
  rawState: unknown,
  maxBytes: number,
): ComposerTextDraftStorageState {
  if (!isPlainRecord(rawState)) {
    return { version: 1, draftsByThreadId: {} };
  }
  const rawDrafts =
    isPlainRecord(rawState.state) && isPlainRecord(rawState.state.draftsByThreadId)
      ? rawState.state.draftsByThreadId
      : rawState.draftsByThreadId;
  return {
    version: 1,
    draftsByThreadId: collectDraftsFromMap(rawDrafts, maxBytes),
  };
}

function readLegacyDrafts(storage: DraftStorage, maxBytes: number): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const key of LEGACY_COMPOSER_DRAFT_STORAGE_KEYS) {
    const parsed = parseJsonObject(storage.getItem(key));
    const state = isPlainRecord(parsed?.state) ? parsed.state : parsed;
    if (!state) {
      continue;
    }
    for (const source of [state.draftsByThreadId, state.draftsByThreadKey]) {
      for (const [threadId, prompt] of Object.entries(collectDraftsFromMap(source, maxBytes))) {
        drafts[threadId] ??= prompt;
      }
    }
  }
  return drafts;
}

function readDraftState(storage: DraftStorage, maxBytes: number): ComposerTextDraftStorageState {
  const currentRaw = parseJsonObject(storage.getItem(COMPOSER_TEXT_DRAFTS_STORAGE_KEY));
  const current = normalizeTextDraftStorageState(currentRaw, maxBytes);
  if (currentRaw) {
    return current;
  }
  const legacyDrafts = readLegacyDrafts(storage, maxBytes);
  const mergedDrafts = { ...legacyDrafts, ...current.draftsByThreadId };
  return { version: 1, draftsByThreadId: mergedDrafts };
}

function writeDraftState(storage: DraftStorage, state: ComposerTextDraftStorageState): void {
  storage.setItem(COMPOSER_TEXT_DRAFTS_STORAGE_KEY, JSON.stringify(state));
}

export function restorePersistedDraft(
  threadId: ThreadId,
  options: DraftPersistenceOptions = {},
): string {
  if (threadId.length === 0) {
    return "";
  }
  const storage = options.storage ?? resolveBrowserStorage();
  if (!storage) {
    return "";
  }
  const maxBytes = options.maxBytes ?? COMPOSER_DRAFT_MAX_BYTES;
  const state = readDraftState(storage, maxBytes);
  writeDraftState(storage, state);
  return state.draftsByThreadId[threadId] ?? "";
}

export function savePersistedDraft(
  threadId: ThreadId,
  text: string,
  options: DraftPersistenceOptions = {},
): void {
  if (threadId.length === 0) {
    return;
  }
  const storage = options.storage ?? resolveBrowserStorage();
  if (!storage) {
    return;
  }
  const maxBytes = options.maxBytes ?? COMPOSER_DRAFT_MAX_BYTES;
  const state = readDraftState(storage, maxBytes);
  const normalized = normalizeDraftText(text, maxBytes);
  if (normalized === null) {
    delete state.draftsByThreadId[threadId];
  } else {
    state.draftsByThreadId[threadId] = normalized;
  }
  writeDraftState(storage, state);
}

export function clearPersistedDraft(
  threadId: ThreadId,
  options: DraftPersistenceOptions = {},
): void {
  if (threadId.length === 0) {
    return;
  }
  const storage = options.storage ?? resolveBrowserStorage();
  if (!storage) {
    return;
  }
  const state = readDraftState(storage, options.maxBytes ?? COMPOSER_DRAFT_MAX_BYTES);
  delete state.draftsByThreadId[threadId];
  writeDraftState(storage, state);
}

export function createDraftPersistenceController(
  options: DraftPersistenceOptions = {},
): DraftPersistenceController {
  const storage = options.storage ?? resolveBrowserStorage();
  const debounceMs = options.debounceMs ?? COMPOSER_DRAFT_SAVE_DEBOUNCE_MS;
  const maxBytes = options.maxBytes ?? COMPOSER_DRAFT_MAX_BYTES;
  let pending: {
    threadId: ThreadId;
    text: string;
  } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending || !storage) {
      pending = null;
      return;
    }
    const next = pending;
    pending = null;
    savePersistedDraft(next.threadId, next.text, { storage, maxBytes });
  };

  return {
    restoreDraft: (threadId) => {
      if (!storage) {
        return "";
      }
      return restorePersistedDraft(threadId, { storage, maxBytes });
    },
    saveDraft: (threadId, text) => {
      if (!storage || threadId.length === 0) {
        return;
      }
      pending = { threadId, text };
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(flush, debounceMs);
    },
    clearDraft: (threadId) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (pending?.threadId === threadId) {
        pending = null;
      }
      if (storage) {
        clearPersistedDraft(threadId, { storage, maxBytes });
      }
    },
    flush,
    dispose: () => {
      flush();
    },
  };
}

export function useDraftPersistence({
  threadId,
  text,
  onRestoreDraft,
  storage,
}: UseDraftPersistenceInput): {
  clearDraft: (targetThreadId?: ThreadId) => void;
  flush: () => void;
} {
  const textRef = useRef(text);
  const controllerRef = useRef<DraftPersistenceController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createDraftPersistenceController(storage ? { storage } : {});
  }

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }
    controller.flush();
    const restored = controller.restoreDraft(threadId);
    if (restored.length > 0 && restored !== textRef.current) {
      onRestoreDraft(restored);
    }
    return () => {
      controller.flush();
    };
  }, [onRestoreDraft, threadId]);

  useEffect(() => {
    controllerRef.current?.saveDraft(threadId, text);
  }, [text, threadId]);

  useEffect(() => {
    const controller = controllerRef.current;
    return () => {
      controller?.dispose();
    };
  }, []);

  const clearDraft = useCallback(
    (targetThreadId?: ThreadId) => {
      controllerRef.current?.clearDraft(targetThreadId ?? threadId);
    },
    [threadId],
  );

  const flush = useCallback(() => {
    controllerRef.current?.flush();
  }, []);

  return { clearDraft, flush };
}

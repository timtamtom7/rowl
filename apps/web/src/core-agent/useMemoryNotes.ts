import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CoreAgentScope,
  MemoryNote,
  MemoryNoteSummary,
  MemoryNoteWriteRequest,
  NativeApi,
} from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";

export type MemoryNotesController = {
  readonly notes: ReadonlyArray<MemoryNoteSummary>;
  readonly selectedNote: MemoryNote | null;
  readonly selectedFilename: string | null;
  readonly isLoading: boolean;
  readonly isReading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly selectNote: (filename: string) => Promise<void>;
  readonly write: (
    input: Omit<MemoryNoteWriteRequest, "scope" | "agentId">,
  ) => Promise<MemoryNote | null>;
  readonly deleteNote: (filename: string) => Promise<void>;
};

export function useMemoryNotes(input: {
  readonly scope: CoreAgentScope;
  readonly agentId: string | null;
  readonly api?: NativeApi | undefined;
}): MemoryNotesController {
  const api = input.api ?? readNativeApi();
  const [notes, setNotes] = useState<ReadonlyArray<MemoryNoteSummary>>([]);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<MemoryNote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestBase = useMemo(() => {
    if (!input.agentId) return null;
    return { scope: input.scope, agentId: input.agentId };
  }, [input.agentId, input.scope]);

  const refresh = useCallback(async () => {
    if (!api?.memoryNotes || !requestBase) {
      setNotes([]);
      setSelectedFilename(null);
      setSelectedNote(null);
      setIsLoading(false);
      setError(requestBase ? "Native API is unavailable." : null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.memoryNotes.list(requestBase);
      setNotes(result.notes);
      const nextSelected =
        selectedFilename && result.notes.some((note) => note.filename === selectedFilename)
          ? selectedFilename
          : result.notes[0]?.filename ?? null;
      setSelectedFilename(nextSelected);
      if (!nextSelected) {
        setSelectedNote(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load memory notes.");
    } finally {
      setIsLoading(false);
    }
  }, [api, requestBase, selectedFilename]);

  const selectNote = useCallback(
    async (filename: string) => {
      if (!api?.memoryNotes || !requestBase) return;
      setSelectedFilename(filename);
      setIsReading(true);
      setError(null);
      try {
        const result = await api.memoryNotes.read({ ...requestBase, filename });
        setSelectedNote(result.note);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not read memory note.");
      } finally {
        setIsReading(false);
      }
    },
    [api, requestBase],
  );

  const write = useCallback(
    async (note: Omit<MemoryNoteWriteRequest, "scope" | "agentId">) => {
      if (!api?.memoryNotes || !requestBase) return null;
      setError(null);
      try {
        const result = await api.memoryNotes.write({ ...requestBase, ...note });
        setSelectedFilename(result.note.filename);
        setSelectedNote(result.note);
        await refresh();
        return result.note;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save memory note.");
        return null;
      }
    },
    [api, refresh, requestBase],
  );

  const deleteNote = useCallback(
    async (filename: string) => {
      if (!api?.memoryNotes || !requestBase) return;
      setError(null);
      try {
        await api.memoryNotes.delete({ ...requestBase, filename });
        if (selectedFilename === filename) {
          setSelectedFilename(null);
          setSelectedNote(null);
        }
        await refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not delete memory note.");
      }
    },
    [api, refresh, requestBase, selectedFilename],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedFilename) {
      void selectNote(selectedFilename);
    }
  }, [selectNote, selectedFilename]);

  useEffect(() => {
    if (!api?.memoryNotes || !requestBase) return undefined;
    return api.memoryNotes.onChanged((event) => {
      const sameAgent = event.agentId === requestBase.agentId;
      const sameScope =
        event.scope.type === requestBase.scope.type &&
        (event.scope.type === "global" ||
          (requestBase.scope.type === "project" &&
            event.scope.projectRoot === requestBase.scope.projectRoot));
      if (sameAgent && sameScope) {
        void refresh();
      }
    });
  }, [api, refresh, requestBase]);

  return {
    notes,
    selectedNote,
    selectedFilename,
    isLoading,
    isReading,
    error,
    refresh,
    selectNote,
    write,
    deleteNote,
  };
}

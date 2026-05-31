import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CreateGoalDocumentInput,
  GoalDocument,
  GoalDocumentId,
  GoalId,
  NativeApi,
  UpdateGoalDocumentInput,
  WriteGoalDocumentInput,
} from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";

type DocumentVersion = GoalDocument["version"];

export type DocumentsController = {
  readonly documents: ReadonlyArray<GoalDocument>;
  readonly selectedDocumentId: GoalDocumentId | null;
  readonly selectedDocument: GoalDocument | null;
  readonly isLoading: boolean;
  readonly isReading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly selectDocument: (
    documentId: GoalDocumentId,
    version?: DocumentVersion,
  ) => Promise<GoalDocument | null>;
  readonly listByGoal: (goalId?: GoalId) => Promise<ReadonlyArray<GoalDocument>>;
  readonly read: (input: {
    readonly documentId: GoalDocumentId;
    readonly version?: DocumentVersion;
  }) => Promise<GoalDocument | null>;
  readonly write: (input: Omit<WriteGoalDocumentInput, "goalId">) => Promise<GoalDocument>;
  readonly create: (input: Omit<CreateGoalDocumentInput, "goalId">) => Promise<GoalDocument>;
  readonly update: (input: Omit<UpdateGoalDocumentInput, "goalId">) => Promise<GoalDocument>;
  readonly delete: (documentId: GoalDocumentId) => Promise<void>;
};

export type DocumentActions = Pick<
  DocumentsController,
  "listByGoal" | "read" | "write" | "create" | "update" | "delete"
>;

export function createDocumentActions(input: {
  readonly api: Pick<NativeApi, "documents">;
  readonly goalId: GoalId;
}): DocumentActions {
  return {
    async listByGoal(nextGoalId) {
      const result = await input.api.documents.listByGoal({ goalId: nextGoalId ?? input.goalId });
      return result.documents;
    },
    async read(readInput) {
      const result = await input.api.documents.read({ goalId: input.goalId, ...readInput });
      return result.document;
    },
    async write(writeInput) {
      const result = await input.api.documents.write({ goalId: input.goalId, ...writeInput });
      return result.document;
    },
    async create(createInput) {
      const result = await input.api.documents.create({ goalId: input.goalId, ...createInput });
      return result.document;
    },
    async update(updateInput) {
      const result = await input.api.documents.update({ goalId: input.goalId, ...updateInput });
      return result.document;
    },
    async delete(documentId) {
      await input.api.documents.delete({ goalId: input.goalId, documentId });
    },
  };
}

export function useDocuments(input: {
  readonly goalId: GoalId | null | undefined;
  readonly api?: NativeApi | undefined;
}): DocumentsController {
  const api = input.api ?? readNativeApi();
  const goalId = input.goalId;
  const actions = useMemo(
    () => (api && goalId ? createDocumentActions({ api, goalId }) : null),
    [api, goalId],
  );
  const [documents, setDocuments] = useState<ReadonlyArray<GoalDocument>>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<GoalDocumentId | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<GoalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(goalId));
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!actions || !goalId) {
      setDocuments([]);
      setSelectedDocumentId(null);
      setSelectedDocument(null);
      setIsLoading(false);
      setError(api ? null : "Native API is unavailable.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const nextDocuments = await actions.listByGoal(goalId);
      setDocuments(nextDocuments);
      setSelectedDocumentId((current) => current ?? nextDocuments[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load documents.");
    } finally {
      setIsLoading(false);
    }
  }, [actions, api, goalId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!api || !goalId) return;
    return api.documents.onChanged((event) => {
      if (event.domain !== "documents") return;
      if (event.goalId && event.goalId !== goalId) return;
      void refresh();
    });
  }, [api, goalId, refresh]);

  const read = useCallback(
    async (readInput: {
      readonly documentId: GoalDocumentId;
      readonly version?: DocumentVersion;
    }) => {
      if (!actions) return null;
      setIsReading(true);
      setError(null);
      try {
        const document = await actions.read(readInput);
        setSelectedDocumentId(document?.id ?? readInput.documentId);
        setSelectedDocument(document);
        return document;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not read document.");
        return null;
      } finally {
        setIsReading(false);
      }
    },
    [actions],
  );

  const selectDocument = useCallback(
    (documentId: GoalDocumentId, version?: DocumentVersion) =>
      read({ documentId, ...(version === undefined ? {} : { version }) }),
    [read],
  );

  const saveAndTrack = useCallback(
    async (operation: () => Promise<GoalDocument>) => {
      if (!actions) throw new Error("Native API is unavailable.");
      setError(null);
      try {
        const document = await operation();
        setDocuments((current) => [...current.filter((item) => item.id !== document.id), document]);
        setSelectedDocumentId(document.id);
        setSelectedDocument(document);
        return document;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not save document.";
        setError(message);
        throw new Error(message, { cause: caught });
      }
    },
    [actions],
  );

  return {
    documents,
    selectedDocumentId,
    selectedDocument,
    isLoading,
    isReading,
    error,
    refresh,
    selectDocument,
    listByGoal: async (nextGoalId) => {
      if (!actions) return [];
      return actions.listByGoal(nextGoalId);
    },
    read,
    write: (writeInput) => saveAndTrack(() => actions!.write(writeInput)),
    create: (createInput) => saveAndTrack(() => actions!.create(createInput)),
    update: (updateInput) => saveAndTrack(() => actions!.update(updateInput)),
    async delete(documentId) {
      if (!actions) return;
      await actions.delete(documentId);
      setDocuments((current) => current.filter((document) => document.id !== documentId));
      if (selectedDocumentId === documentId) {
        setSelectedDocumentId(null);
        setSelectedDocument(null);
      }
    },
  };
}

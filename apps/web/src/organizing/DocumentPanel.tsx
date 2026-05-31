import {
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GoalDocument, GoalDocumentId, GoalId } from "@t3tools/contracts";

import { cn } from "~/lib/utils";
import { useDocuments, type DocumentsController } from "./useDocuments";

type DocumentVersion = GoalDocument["version"];

export function DocumentPanel({
  goalId,
  controller,
}: {
  readonly goalId: GoalId | null | undefined;
  readonly controller?: DocumentsController;
}) {
  const liveController = useDocuments({ goalId });
  const documents = controller ?? liveController;
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!documents.selectedDocument) return;
    setDraftTitle(documents.selectedDocument.title);
    setDraftContent(documents.selectedDocument.content);
  }, [documents.selectedDocument]);

  const versions = useMemo(() => {
    const version = documents.selectedDocument?.version ?? 0;
    return Array.from({ length: version }, (_, index) => index + 1);
  }, [documents.selectedDocument?.version]);

  const startNewDocument = () => {
    setDraftTitle("New document");
    setDraftContent("# New document\n");
  };

  const saveDocument = async () => {
    if (!goalId) return;
    const title = draftTitle.trim() || "Untitled document";
    setIsSaving(true);
    try {
      if (documents.selectedDocumentId) {
        await documents.write({
          documentId: documents.selectedDocumentId,
          title,
          content: draftContent,
        });
      } else {
        await documents.create({ title, content: draftContent });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (document: GoalDocument) => {
    const ok =
      typeof window === "undefined" ||
      window.confirm(`Delete document "${document.title}"? This cannot be undone.`);
    if (ok) {
      void documents.delete(document.id);
    }
  };

  return (
    <section className="flex min-h-0 flex-col border-b border-border/40">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
          <span className="text-xs font-medium text-foreground/80">Documents</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={startNewDocument}
            disabled={!goalId}
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] text-muted-foreground/70 transition-colors hover:bg-accent/50 hover:text-foreground/80 disabled:opacity-40"
          >
            <PlusIcon className="size-3" />
            New
          </button>
          <button
            type="button"
            onClick={() => void documents.refresh()}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground/55 hover:bg-accent/50 hover:text-foreground/80"
            aria-label="Refresh documents"
          >
            <RefreshCwIcon className="size-3" />
          </button>
        </div>
      </div>

      <div className="space-y-2 px-3 pb-3">
        {!goalId ? (
          <div className="rounded-md border border-border/50 bg-muted/15 px-2 py-2 text-[11px] text-muted-foreground/60">
            Select a goal to manage documents.
          </div>
        ) : null}

        {documents.isLoading ? (
          <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground/55">
            <Loader2Icon className="size-3 animate-spin" />
            Loading documents...
          </div>
        ) : null}

        {documents.error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
            {documents.error}
          </div>
        ) : null}

        {goalId && documents.documents.length === 0 ? (
          <div className="rounded-md border border-border/50 bg-muted/15 px-2 py-2 text-[11px] text-muted-foreground/60">
            No documents for this goal.
          </div>
        ) : null}

        {documents.documents.length > 0 || draftTitle ? (
          <div className="grid min-h-[260px] grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] overflow-hidden rounded-md border border-border/50">
            <div className="min-h-0 border-r border-border/40">
              {documents.documents.map((document) => {
                const isSelected = document.id === documents.selectedDocumentId;
                return (
                  <div
                    key={document.id}
                    className={cn(
                      "flex items-start gap-1 border-b border-border/30 transition-colors",
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground/75 hover:bg-accent/50 hover:text-foreground/85",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void documents.selectDocument(document.id)}
                      className="flex min-w-0 flex-1 items-start gap-1.5 px-2 py-1.5 text-left"
                    >
                      <FileTextIcon className="mt-0.5 size-3 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-medium">
                          {document.title}
                        </span>
                        <span className="block truncate text-[9px] text-muted-foreground/55">
                          v{document.version} · {document.id}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDelete(document)}
                      aria-label={`Delete document ${document.title}`}
                      className="m-1 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2Icon className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="min-h-0 overflow-y-auto p-2">
              {documents.isReading ? (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground/55">
                  <Loader2Icon className="size-3 animate-spin" />
                  Loading document...
                </div>
              ) : (
                <article className="space-y-2">
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="Document title"
                    className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[12px] font-medium text-foreground/90"
                  />
                  {documents.selectedDocument ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-muted-foreground/50">Version</span>
                      <select
                        value={documents.selectedDocument.version}
                        onChange={(event) =>
                          void documents.selectDocument(
                            documents.selectedDocumentId as GoalDocumentId,
                            Number(event.target.value) as DocumentVersion,
                          )
                        }
                        className="h-6 rounded-md border border-border/60 bg-background px-1.5 text-[10px]"
                      >
                        {versions.map((version) => (
                          <option key={version} value={version}>
                            v{version}
                          </option>
                        ))}
                      </select>
                      <span className="truncate text-[9px] text-muted-foreground/45">
                        Updated {new Date(documents.selectedDocument.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  ) : null}
                  <textarea
                    value={draftContent}
                    onChange={(event) => setDraftContent(event.target.value)}
                    placeholder="Document content..."
                    className="min-h-[160px] w-full resize-y rounded-md border border-border/60 bg-background p-2 text-[11px] leading-relaxed text-foreground/80"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveDocument()}
                      disabled={!goalId || isSaving || !draftTitle.trim()}
                      className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
                    >
                      {isSaving ? (
                        <Loader2Icon className="size-3 animate-spin" />
                      ) : (
                        <SaveIcon className="size-3" />
                      )}
                      Save
                    </button>
                  </div>
                </article>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

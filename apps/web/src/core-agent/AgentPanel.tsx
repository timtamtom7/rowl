import {
  BotIcon,
  BrainIcon,
  CheckIcon,
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "~/lib/utils";
import {
  CORE_AGENT_PRESETS,
  type CoreAgentController,
  type CoreAgentPresetId,
  scopeForProjectRoot,
  useCoreAgents,
} from "./useCoreAgents";
import { useMemoryNotes, type MemoryNotesController } from "./useMemoryNotes";

type AgentPanelTab = "agents" | "memory";

export function AgentPanel({
  projectRoot,
  controller,
  memoryController,
  defaultTab = "agents",
}: {
  readonly projectRoot?: string | null | undefined;
  readonly controller?: CoreAgentController;
  readonly memoryController?: MemoryNotesController;
  readonly defaultTab?: AgentPanelTab;
}) {
  const liveController = useCoreAgents({ projectRoot });
  const agents = controller ?? liveController;
  const scope = useMemo(() => scopeForProjectRoot(projectRoot), [projectRoot]);
  const liveMemory = useMemoryNotes({ scope, agentId: agents.activeAgentId });
  const memory = memoryController ?? liveMemory;
  const [presetId, setPresetId] = useState<CoreAgentPresetId>("default");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<AgentPanelTab>(defaultTab);

  const createAgent = async () => {
    setIsCreating(true);
    try {
      await agents.createFromPreset(presetId);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="flex min-h-0 flex-col border-b border-border/40">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {activeTab === "agents" ? (
            <BotIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
          ) : (
            <BrainIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
          )}
          <span className="text-xs font-medium text-foreground/80">
            {activeTab === "agents" ? "Agents" : "Memory"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void (activeTab === "agents" ? agents.refresh() : memory.refresh())}
          className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:bg-accent/50 hover:text-foreground/80"
        >
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-1 px-3 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("agents")}
          aria-selected={activeTab === "agents"}
          className={cn(
            "flex h-6 items-center gap-1 rounded-md px-2 text-[11px] transition-colors",
            activeTab === "agents"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground/65 hover:bg-accent/50 hover:text-foreground/80",
          )}
        >
          <BotIcon className="size-3" />
          Agents
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("memory")}
          aria-selected={activeTab === "memory"}
          className={cn(
            "flex h-6 items-center gap-1 rounded-md px-2 text-[11px] transition-colors",
            activeTab === "memory"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground/65 hover:bg-accent/50 hover:text-foreground/80",
          )}
        >
          <BrainIcon className="size-3" />
          Memory
        </button>
      </div>

      {activeTab === "memory" ? <MemoryNotesPanel memory={memory} /> : null}
      {activeTab === "agents" ? (
      <div className="space-y-2 px-3 pb-3">
        {agents.isLoading ? (
          <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground/55">
            <Loader2Icon className="size-3 animate-spin" />
            Loading agents...
          </div>
        ) : null}

        {agents.error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
            {agents.error}
          </div>
        ) : null}

        {!agents.isLoading && agents.agents.length === 0 ? (
          <div className="rounded-md border border-border/50 bg-muted/15 px-2 py-2 text-[11px] text-muted-foreground/60">
            No agents yet. Create one from a preset to bind it to this scope.
          </div>
        ) : null}

        {agents.activeAgent ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-primary/70">
              <CheckIcon className="size-3" />
              Active
            </div>
            <div className="mt-0.5 truncate text-[12px] font-medium text-foreground/90">
              {agents.activeAgent.name}
            </div>
            {agents.activeAgent.description ? (
              <div className="truncate text-[10px] text-muted-foreground/55">
                {agents.activeAgent.description}
              </div>
            ) : null}
          </div>
        ) : null}

        {agents.agents.length > 0 ? (
          <div className="space-y-1">
            {agents.agents.map((agent) => {
              const isActive = agent.id === agents.activeAgentId;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => void agents.setActiveAgent(agent.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground/75 hover:bg-accent/50 hover:text-foreground/85",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium">{agent.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground/55">
                      {agent.personality.kind === "preset" ? agent.personality.presetId : "custom"}
                    </span>
                  </span>
                  {isActive ? <CheckIcon className="size-3 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="core-agent-preset">
            Create from preset
          </label>
          <select
            id="core-agent-preset"
            value={presetId}
            onChange={(event) => setPresetId(event.target.value as CoreAgentPresetId)}
            className="min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px]"
          >
            {CORE_AGENT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void createAgent()}
            disabled={isCreating}
            className="flex h-7 shrink-0 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {isCreating ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <PlusIcon className="size-3" />
            )}
            Create from preset
          </button>
        </div>
      </div>
      ) : null}
    </section>
  );
}

function MemoryNotesPanel({ memory }: { readonly memory: MemoryNotesController }) {
  const [draft, setDraft] = useState(() =>
    memory.selectedNote
      ? draftFromNote(memory.selectedNote)
      : {
          filename: "",
          title: "",
          tags: "",
          content: "",
          isNew: false,
        },
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!memory.selectedNote) return;
    setDraft(draftFromNote(memory.selectedNote));
  }, [memory.selectedNote]);

  const startNewNote = () => {
    const filename = nextNewNoteFilename(memory.notes.map((note) => note.filename));
    setDraft({
      filename,
      title: "New note",
      tags: "",
      content: "# New note\n",
      isNew: true,
    });
  };

  const saveDraft = async () => {
    setIsSaving(true);
    try {
      const saved = await memory.write({
        filename: slugifyDraftFilename(draft.filename),
        title: draft.title.trim() || "Untitled memory note",
        tags: parseDraftTags(draft.tags),
        content: draft.content,
      });
      if (saved) {
        setDraft({
          filename: saved.filename,
          title: saved.title,
          tags: saved.tags.join(", "),
          content: saved.content,
          isNew: false,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (filename: string) => {
    const ok =
      typeof window === "undefined" ||
      window.confirm(`Delete memory note "${filename}"? This cannot be undone.`);
    if (ok) {
      void memory.deleteNote(filename);
    }
  };

  const hasEditableNote = draft.isNew || memory.selectedNote !== null;

  return (
    <div className="min-h-0 px-3 pb-3">
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          onClick={startNewNote}
          className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground"
        >
          <PlusIcon className="size-3" />
          New Note
        </button>
      </div>

      {memory.isLoading ? (
        <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground/55">
          <Loader2Icon className="size-3 animate-spin" />
          Loading memory...
        </div>
      ) : null}

      {memory.error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {memory.error}
        </div>
      ) : null}

      {!memory.isLoading && memory.notes.length === 0 ? (
        <div className="rounded-md border border-border/50 bg-muted/15 px-2 py-2 text-[11px] text-muted-foreground/60">
          No memory notes yet.
        </div>
      ) : null}

      {memory.notes.length > 0 || draft.isNew ? (
        <div className="grid min-h-[220px] grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] overflow-hidden rounded-md border border-border/50">
          <div className="min-h-0 border-r border-border/40">
            {memory.notes.map((note) => {
              const isSelected = note.filename === memory.selectedFilename;
              return (
                <div
                  key={note.filename}
                  className={cn(
                    "flex items-start gap-1 border-b border-border/30 transition-colors",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground/75 hover:bg-accent/50 hover:text-foreground/85",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void memory.selectNote(note.filename)}
                    aria-current={isSelected ? "true" : undefined}
                    className="flex min-w-0 flex-1 items-start gap-1.5 px-2 py-1.5 text-left"
                  >
                    <FileTextIcon className="mt-0.5 size-3 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-medium">{note.title}</span>
                      <span className="block truncate text-[9px] text-muted-foreground/55">
                        {note.filename}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDelete(note.filename)}
                    aria-label={`Delete memory note ${note.filename}`}
                    className="m-1 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2Icon className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="min-h-0 overflow-y-auto p-2">
            {memory.isReading ? (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground/55">
                <Loader2Icon className="size-3 animate-spin" />
                Loading note...
              </div>
            ) : hasEditableNote ? (
              <article className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Memory note title</span>
                    <input
                      value={draft.title}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, title: event.target.value }))
                      }
                      className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[12px] font-medium text-foreground/90"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void memory.refresh()}
                    aria-label="Refresh memory notes"
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/55 hover:bg-accent/50 hover:text-foreground/80"
                  >
                    <RefreshCwIcon className="size-3" />
                  </button>
                </div>
                <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-1.5">
                  <label>
                    <span className="sr-only">Memory note filename</span>
                    <input
                      value={draft.filename}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, filename: event.target.value }))
                      }
                      className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[10px] text-muted-foreground"
                      placeholder="note-slug"
                    />
                  </label>
                  <label>
                    <span className="sr-only">Memory note tags</span>
                    <input
                      value={draft.tags}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, tags: event.target.value }))
                      }
                      className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[10px] text-muted-foreground"
                      placeholder="tag, another-tag"
                    />
                  </label>
                </div>
                {memory.selectedNote && !draft.isNew ? (
                  <p className="truncate text-[9px] text-muted-foreground/50">
                    Updated {new Date(memory.selectedNote.updated).toLocaleString()}
                  </p>
                ) : null}
                <label className="block">
                  <span className="sr-only">Memory note content</span>
                  <textarea
                    value={draft.content}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, content: event.target.value }))
                    }
                    className="min-h-[150px] w-full resize-y rounded-md border border-border/60 bg-background p-2 text-[11px] leading-relaxed text-foreground/80"
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveDraft()}
                    disabled={isSaving || draft.filename.trim().length === 0}
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
            ) : (
              <div className="py-8 text-center text-[11px] text-muted-foreground/55">
                Select a memory note.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function nextNewNoteFilename(existing: ReadonlyArray<string>): string {
  const used = new Set(existing);
  if (!used.has("new-note")) return "new-note";
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `new-note-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return `new-note-${Date.now()}`;
}

function draftFromNote(note: MemoryNotesController["selectedNote"]) {
  if (!note) {
    return {
      filename: "",
      title: "",
      tags: "",
      content: "",
      isNew: false,
    };
  }
  return {
    filename: note.filename,
    title: note.title,
    tags: note.tags.join(", "),
    content: note.content,
    isNew: false,
  };
}

function slugifyDraftFilename(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "memory-note"
  );
}

function parseDraftTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

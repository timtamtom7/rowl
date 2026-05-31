import { useState, useCallback } from "react";
import {
  SearchIcon,
  PlusIcon,
  Trash2Icon,
  BrainIcon,
  SparklesIcon,
  StarIcon,
  Loader2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  BotIcon,
  UserIcon,
  ArrowUpDownIcon,
} from "lucide-react";
import type { ProjectId } from "@t3tools/contracts";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useSidebarMemories } from "~/lib/sidebarReactQuery";

interface MemoryEntry {
  id: string;
  type: string;
  content: string;
  summary: string;
  importance: number;
  createdAt: string;
  lastAccessedAt: string | null;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  decision: { label: "Decision", color: "text-blue-400" },
  preference: { label: "Preference", color: "text-purple-400" },
  fact: { label: "Fact", color: "text-emerald-400" },
  context: { label: "Context", color: "text-amber-400" },
  architecture: { label: "Architecture", color: "text-cyan-400" },
};

type SortMode = "importance" | "recent";

export function MemoryTabContent({ projectId }: { projectId: ProjectId }) {
  const { memories, isLoading, createMemory, deleteMemory, search } = useSidebarMemories(projectId);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryEntry[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("importance");

  const [newSummary, setNewSummary] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<string>("fact");

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const results = await search(query);
      setSearchResults(results as unknown as MemoryEntry[]);
    } catch {
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, search]);

  const handleCreate = useCallback(() => {
    const summary = newSummary.trim();
    if (!summary) return;
    createMemory.mutate({
      type: newType,
      content: newContent.trim() || summary,
      summary,
      importance: 4,
    });
    setNewSummary("");
    setNewContent("");
    setIsCreating(false);
  }, [newSummary, newContent, newType, createMemory]);

  const displayMemories = (searchResults ?? memories) as unknown as MemoryEntry[];
  const sortedMemories = [...displayMemories].sort((a, b) => {
    if (sortMode === "importance") return b.importance - a.importance;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin mr-2" />
        Loading memories...
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-1.5">
          <BrainIcon className="size-3.5 text-muted-foreground/60" />
          <span className="text-xs font-medium text-foreground/80">Memory ({memories.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            className="h-5 w-5 p-0"
            onClick={() => setSortMode(sortMode === "importance" ? "recent" : "importance")}
            title={`Sort by ${sortMode === "importance" ? "recent" : "importance"}`}
          >
            <ArrowUpDownIcon className="size-3" />
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="h-5 text-[10px]"
            onClick={() => setIsCreating(!isCreating)}
          >
            <PlusIcon className="size-3 mr-0.5" />
            Remember
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-1.5">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) setSearchResults(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
              if (e.key === "Escape") {
                setSearchQuery("");
                setSearchResults(null);
              }
            }}
            placeholder="Search memories..."
            className="text-xs h-7"
          />
          <Button
            size="xs"
            variant="ghost"
            onClick={() => void handleSearch()}
            disabled={isSearching}
          >
            {isSearching ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <SearchIcon className="size-3" />
            )}
          </Button>
        </div>
        {searchResults !== null && (
          <p className="text-[9px] text-muted-foreground/40 mt-1">
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSearchResults(null);
              }}
              className="ml-1 text-primary/60 hover:text-primary"
            >
              Clear
            </button>
          </p>
        )}
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="border-b border-border/40 px-3 py-3 space-y-2 bg-accent/10 shrink-0">
          <Input
            value={newSummary}
            onChange={(e) => setNewSummary(e.target.value)}
            placeholder="What should the AI remember?"
            className="text-xs h-7"
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Details (optional)..."
            className="w-full min-h-[50px] rounded-md border border-border bg-background px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center justify-between">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-[10px]"
            >
              <option value="fact">Fact</option>
              <option value="decision">Decision</option>
              <option value="preference">Preference</option>
              <option value="architecture">Architecture</option>
            </select>
            <div className="flex gap-1">
              <Button
                size="xs"
                variant="ghost"
                className="h-6 text-[10px]"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                variant="outline"
                className="h-6 text-[10px]"
                onClick={handleCreate}
                disabled={!newSummary.trim() || createMemory.isPending}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Memory list */}
      {sortedMemories.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
          <BrainIcon className="size-6 text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">
            {searchResults !== null ? "No memories match your search." : "No memories yet."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Memories are created automatically from conversations and manually by you.
          </p>
        </div>
      ) : (
        sortedMemories.map((memory) => {
          const typeInfo = TYPE_LABELS[memory.type] ?? {
            label: memory.type,
            color: "text-muted-foreground",
          };
          const isExpanded = expandedId === memory.id;

          return (
            <div key={memory.id} className="border-b border-border/40">
              <div
                className="flex items-start gap-2 px-3 py-2.5 group hover:bg-accent/15 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : memory.id)}
              >
                {isExpanded ? (
                  <ChevronDownIcon className="size-3 mt-0.5 text-muted-foreground/30 shrink-0" />
                ) : (
                  <ChevronRightIcon className="size-3 mt-0.5 text-muted-foreground/30 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className={cn("text-[10px] font-medium", typeInfo.color)}>
                      {typeInfo.label}
                    </span>
                    {memory.importance >= 4 && (
                      <StarIcon className="size-2.5 fill-amber-500 text-amber-500" />
                    )}
                    {memory.lastAccessedAt && (
                      <span className="text-[8px] text-emerald-400/60 bg-emerald-500/10 px-1 rounded">
                        used by AI
                      </span>
                    )}
                  </div>
                  <p className={cn("text-xs text-foreground/80", !isExpanded && "line-clamp-2")}>
                    {memory.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMemory.mutate(memory.id);
                  }}
                  className="mt-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
                >
                  <Trash2Icon className="size-3" />
                </button>
              </div>

              {/* Expanded detail */}
              {isExpanded && memory.content !== memory.summary && (
                <div className="px-3 pb-2 pl-8 text-[10px] text-muted-foreground/60 bg-accent/5">
                  <p className="whitespace-pre-wrap break-words">{memory.content}</p>
                  <p className="mt-1 text-[9px] text-muted-foreground/30">
                    Created {new Date(memory.createdAt).toLocaleDateString()}
                    {memory.lastAccessedAt &&
                      ` · Last used ${new Date(memory.lastAccessedAt).toLocaleDateString()}`}
                  </p>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

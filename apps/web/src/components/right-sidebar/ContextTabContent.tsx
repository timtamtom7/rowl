import { useState } from "react";
import {
  DatabaseIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  Trash2Icon,
  MessageSquareIcon,
  FileIcon,
  SparklesIcon,
  BrainIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
} from "lucide-react";
import type { ProjectId, ContextNode } from "@t3tools/contracts";

import { useStore } from "~/store";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { useSidebarContext } from "~/lib/sidebarReactQuery";

const NODE_TYPE_CONFIG = {
  messages: { icon: MessageSquareIcon, label: "Messages", color: "text-sky-500" },
  file: { icon: FileIcon, label: "File", color: "text-emerald-500" },
  artifact: { icon: SparklesIcon, label: "Artifact", color: "text-violet-500" },
  memory: { icon: BrainIcon, label: "Memory", color: "text-amber-500" },
} as const;

function formatSize(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ContextTabContent({ projectId }: { projectId: ProjectId }) {
  const threads = useStore((store) => store.threads);
  const activeThread = threads
    .filter((t) => t.projectId === projectId)
    .toSorted((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];

  const {
    nodes,
    budget,
    breakdown,
    isLoading,
    compressNode,
    restoreNode,
    deleteNode,
  } = useSidebarContext(projectId, activeThread?.id ?? null);

  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading context...
      </div>
    );
  }

  const activeNodes = nodes.filter((n) => !n.compressed);
  const compressedNodes = nodes.filter((n) => n.compressed);
  const budgetPercent = budget && budget.total > 0 ? budget.used / budget.total : 0;

  const [showContextDetail, setShowContextDetail] = useState(false);

  return (
    <div className="flex flex-col">
      {/* What the AI sees — detailed token breakdown */}
      {breakdown && breakdown.totalRowlContext > 0 && (
        <div
          className="px-3 py-2 border-b border-border/40 bg-primary/3 cursor-pointer hover:bg-primary/5 transition-colors"
          onClick={() => setShowContextDetail(!showContextDetail)}
        >
          <div className="flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-wider text-primary/50 font-medium">
              AI context per turn
            </p>
            <span className="text-[9px] text-primary/40">
              ~{formatSize(breakdown.totalRowlContext)} total
            </span>
          </div>

          {showContextDetail ? (
            <div className="mt-1.5 space-y-0.5">
              {breakdown.agentsMd > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-foreground/50">AGENTS.md</span>
                  <span className="text-muted-foreground/40 tabular-nums">{formatSize(breakdown.agentsMd)}</span>
                </div>
              )}
              {breakdown.projectContext > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-foreground/50">Brief + Goals + Features</span>
                  <span className="text-muted-foreground/40 tabular-nums">{formatSize(breakdown.projectContext)}</span>
                </div>
              )}
              {breakdown.resumeSummary > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-foreground/50">Session history</span>
                  <span className="text-muted-foreground/40 tabular-nums">{formatSize(breakdown.resumeSummary)}</span>
                </div>
              )}
              {breakdown.skills > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-foreground/50">Skills</span>
                  <span className="text-muted-foreground/40 tabular-nums">{formatSize(breakdown.skills)}</span>
                </div>
              )}
              {activeNodes.length > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-foreground/50">Context nodes</span>
                  <span className="text-muted-foreground/40">{activeNodes.length} active</span>
                </div>
              )}
              <p className="text-[9px] text-muted-foreground/30 mt-1 italic">
                + verification rules + memories + project prompts + harness
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-foreground/50 mt-0.5">
              Click to see token breakdown
            </p>
          )}
        </div>
      )}

      {/* Budget gauge */}
      {budget && (
        <div className="shrink-0 border-b border-border/40 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
              Context Budget
            </span>
            <span className="text-xs text-muted-foreground">
              {formatSize(budget.used)} / {formatSize(budget.total)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                budgetPercent > 0.95
                  ? "bg-red-500"
                  : budgetPercent > 0.8
                    ? "bg-amber-500"
                    : "bg-primary/60",
              )}
              style={{ width: `${Math.min(100, budgetPercent * 100)}%` }}
            />
          </div>

          {/* Warning banner with handoff action */}
          {budgetPercent > 0.8 && (
            <div className="mt-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
              <div className="flex items-start gap-1.5">
                <AlertTriangleIcon className="size-3 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[10px] text-amber-400/80">
                    {budgetPercent > 0.95
                      ? "Context is nearly full. Start a new thread to avoid quality loss."
                      : "Context is filling up. Consider compressing old nodes or continuing in a new thread."}
                  </p>
                  {budgetPercent > 0.9 && (
                    <p className="text-[9px] text-amber-400/60 mt-1">
                      Create a new thread to continue with fresh context.
                      Your brief, goals, and memories carry over automatically.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Breakdown */}
          {breakdown && breakdown.totalRowlContext > 0 && (
            <div className="mt-2 space-y-0.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 font-medium">
                Breakdown
              </p>
              <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                {breakdown.agentsMd > 0 && (
                  <div className="bg-sky-500/60 rounded-full" style={{ flex: breakdown.agentsMd }} title={`AGENTS.md: ~${formatSize(breakdown.agentsMd)}`} />
                )}
                {breakdown.projectContext > 0 && (
                  <div className="bg-emerald-500/60 rounded-full" style={{ flex: breakdown.projectContext }} title={`Project: ~${formatSize(breakdown.projectContext)}`} />
                )}
                {breakdown.resumeSummary > 0 && (
                  <div className="bg-amber-500/60 rounded-full" style={{ flex: breakdown.resumeSummary }} title={`Resume: ~${formatSize(breakdown.resumeSummary)}`} />
                )}
                {breakdown.skills > 0 && (
                  <div className="bg-violet-500/60 rounded-full" style={{ flex: breakdown.skills }} title={`Skills: ~${formatSize(breakdown.skills)}`} />
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-muted-foreground/40">
                {breakdown.agentsMd > 0 && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500/60 mr-0.5" />AGENTS {formatSize(breakdown.agentsMd)}</span>}
                {breakdown.projectContext > 0 && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500/60 mr-0.5" />Project {formatSize(breakdown.projectContext)}</span>}
                {breakdown.resumeSummary > 0 && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/60 mr-0.5" />Resume {formatSize(breakdown.resumeSummary)}</span>}
                {breakdown.skills > 0 && <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500/60 mr-0.5" />Skills {formatSize(breakdown.skills)}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk actions */}
      {activeNodes.length > 3 && (
        <div className="px-3 py-1.5 border-b border-border/40 flex justify-end">
          <Button
            size="xs"
            variant="ghost"
            className="text-[10px] h-5 text-muted-foreground/50"
            onClick={() => {
              // Compress all but the 3 most recent nodes
              const toCompress = activeNodes.slice(0, -3);
              for (const node of toCompress) {
                compressNode.mutate(node.id);
              }
            }}
          >
            <ArchiveIcon className="size-2.5 mr-0.5" />
            Trim old ({activeNodes.length - 3})
          </Button>
        </div>
      )}

      {/* Active nodes */}
      {activeNodes.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium bg-card/40">
            Active ({activeNodes.length})
          </div>
          {activeNodes.map((node) => {
            const config = NODE_TYPE_CONFIG[node.type];
            const Icon = config.icon;
            const isExpanded = expandedNodeId === node.id;

            return (
              <div key={node.id} className="border-b border-border/20">
                <div
                  className="flex items-start gap-2 px-3 py-2 group hover:bg-accent/15 cursor-pointer"
                  onClick={() => setExpandedNodeId(isExpanded ? null : node.id)}
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="size-3 mt-0.5 shrink-0 text-muted-foreground/40" />
                  ) : (
                    <ChevronRightIcon className="size-3 mt-0.5 shrink-0 text-muted-foreground/40" />
                  )}
                  <Icon className={cn("size-3.5 mt-0.5 shrink-0", config.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/80 truncate">{node.summary}</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                      {config.label} · {formatSize(node.size)} · {formatRelativeTime(node.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        compressNode.mutate(node.id);
                      }}
                      className="text-muted-foreground/40 hover:text-amber-500 transition-colors"
                      title="Compress"
                    >
                      <ArchiveIcon className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNode.mutate(node.id);
                      }}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2Icon className="size-3" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-2 pl-10 text-[10px] text-muted-foreground/60 space-y-1 bg-accent/5">
                    <p><strong>Type:</strong> {config.label}</p>
                    <p><strong>Size:</strong> ~{formatSize(node.size)} tokens</p>
                    <p><strong>Created:</strong> {new Date(node.createdAt).toLocaleString()}</p>
                    <p className="whitespace-pre-wrap break-words text-foreground/60">{node.summary}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Compressed nodes */}
      {compressedNodes.length > 0 && (
        <div>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium bg-card/40">
            Compressed ({compressedNodes.length})
          </div>
          {compressedNodes.map((node) => {
            const config = NODE_TYPE_CONFIG[node.type];
            const Icon = config.icon;
            return (
              <div
                key={node.id}
                className="flex items-start gap-2 px-3 py-2 border-b border-border/20 group hover:bg-accent/15 opacity-50"
              >
                <Icon className={cn("size-3.5 mt-0.5 shrink-0", config.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/60 truncate">{node.summary}</p>
                  <p className="text-[10px] text-muted-foreground/30 mt-0.5">
                    {formatSize(node.size)} freed
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restoreNode.mutate(node.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-emerald-500 transition-all"
                  title="Restore"
                >
                  <ArchiveRestoreIcon className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
          <DatabaseIcon className="size-6 text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">No context nodes yet.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Context nodes are created as the AI processes your conversations.
          </p>
        </div>
      )}
    </div>
  );
}

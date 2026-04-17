import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { CircleIcon, SearchIcon } from "lucide-react";
import { ThreadId, type ProjectId } from "@t3tools/contracts";

import { useStore } from "~/store";
import { compareThreadsByRecency } from "~/lib/threadOrdering";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { AgentOverviewSection } from "./AgentOverviewSection";
import { TaskListSection } from "./TaskListSection";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getThreadStatusInfo(thread: { session: any }) {
  const status = thread.session?.status;
  if (status === "running")
    return { label: "Working", color: "text-emerald-400", pulse: true };
  if (status === "connecting")
    return { label: "Connecting", color: "text-sky-400", pulse: true };
  if (status === "error")
    return { label: "Error", color: "text-red-400", pulse: false };
  return null;
}

export function ThreadsTabContent({ projectId }: { projectId: ProjectId }) {
  const navigate = useNavigate();
  const routeThreadId = useParams({
    strict: false,
    select: (params: any) =>
      params.threadId ? ThreadId.makeUnsafe(params.threadId as string) : null,
  });

  const threads = useStore((store) => store.threads);
  const [searchFilter, setSearchFilter] = useState("");

  const projectThreads = useMemo(() => {
    const filtered = threads
      .filter((thread) =>
        thread.projectId === projectId &&
        !thread.title.startsWith("[Product Manager]") &&
        !thread.title.startsWith("[Skill Generator]"),
      )
      .toSorted(compareThreadsByRecency);

    if (!searchFilter.trim()) return filtered;

    const query = searchFilter.toLowerCase();
    return filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        (t.goal && t.goal.toLowerCase().includes(query)),
    );
  }, [threads, projectId, searchFilter]);

  if (projectThreads.length === 0 && !searchFilter) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <p className="text-sm text-muted-foreground">No threads in this project.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Use the main chat to start a conversation, or ask the PM to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      <TaskListSection projectId={projectId} />
      <AgentOverviewSection projectId={projectId} />

      {/* Search */}
      <div className="px-3 py-1.5 border-b border-border/40 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/40" />
          <Input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter threads..."
            className="text-xs h-7 pl-7"
          />
        </div>
      </div>

      {projectThreads.length === 0 && searchFilter && (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground/50">No threads match "{searchFilter}"</p>
        </div>
      )}

      {projectThreads.map((thread) => {
        const isActive = routeThreadId === thread.id;
        const status = getThreadStatusInfo(thread);
        const time = thread.updatedAt ?? thread.createdAt;

        // Unread indicator: thread updated after last visit
        const isUnread =
          !isActive &&
          thread.updatedAt &&
          thread.lastVisitedAt &&
          thread.updatedAt > thread.lastVisitedAt;

        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => {
              void navigate({ to: "/$threadId", params: { threadId: thread.id } });
            }}
            className={cn(
              "flex items-start gap-2 px-3 py-2.5 text-left border-b border-border/20 transition-colors w-full",
              isActive ? "bg-accent/30" : "hover:bg-accent/15",
            )}
          >
            {/* Status / unread dot */}
            <div className="mt-1.5 shrink-0">
              {status ? (
                <CircleIcon
                  className={cn(
                    "size-2 fill-current",
                    status.color,
                    status.pulse && "animate-pulse",
                  )}
                />
              ) : isUnread ? (
                <CircleIcon className="size-2 fill-primary text-primary" />
              ) : (
                <CircleIcon className="size-2 text-muted-foreground/20" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={cn(
                  "text-xs truncate",
                  isActive ? "text-foreground font-medium" : "text-foreground/80",
                  isUnread && !isActive && "font-semibold",
                )}>
                  {thread.title}
                </p>
                <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">
                  {formatRelativeTime(time)}
                </span>
              </div>
              {thread.goal && (
                <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">
                  {thread.goal}
                </p>
              )}
              {status && (
                <span className={cn("text-[9px] font-medium", status.color)}>
                  {status.label}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

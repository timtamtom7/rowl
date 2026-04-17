/**
 * TaskListSection — Shows the AI's current and planned tasks.
 *
 * Two sections:
 * 1. Current Tasks — what the AI is working on right now (from active threads)
 * 2. Planned Tasks — what's queued up next (from backlog features + goals)
 *
 * This gives non-coders visibility into what the AI is doing,
 * what it plans to do next, and how much is left.
 *
 * The AI should understand it doesn't need to finish everything
 * in one session. Tasks persist across sessions.
 */
import { useMemo } from "react";
import {
  CheckCircleIcon,
  CircleDotIcon,
  CircleIcon,
  Loader2Icon,
  ListChecksIcon,
} from "lucide-react";
import type { ProjectId, Feature } from "@t3tools/contracts";

import { useStore } from "~/store";
import { cn } from "~/lib/utils";
import { useSidebarFeatures, useSidebarGoals } from "~/lib/sidebarReactQuery";

interface TaskItem {
  id: string;
  label: string;
  status: "active" | "pending" | "done";
  source: "thread" | "feature" | "goal";
  detail?: string | undefined;
}

export function TaskListSection({ projectId }: { projectId: ProjectId }) {
  const threads = useStore((store) => store.threads);
  const { features } = useSidebarFeatures(projectId);
  const { goals } = useSidebarGoals(projectId);

  const tasks = useMemo(() => {
    const items: TaskItem[] = [];

    // Active tasks from running threads
    const runningThreads = threads.filter(
      (t) => t.projectId === projectId && t.session?.status === "running",
    );
    for (const thread of runningThreads) {
      items.push({
        id: `thread:${thread.id}`,
        label: thread.title,
        status: "active",
        source: "thread",
        detail: thread.goal ?? undefined,
      });
    }

    // In-progress features
    for (const feature of features.filter((f) => f.stage === "in_progress")) {
      // Skip if already represented by a running thread
      const hasThread = runningThreads.some(
        (t) => t.title.includes(feature.name) || t.goal?.includes(feature.name),
      );
      if (!hasThread) {
        items.push({
          id: `feature:${feature.id}`,
          label: feature.name,
          status: "pending",
          source: "feature",
          detail: "In progress",
        });
      }
    }

    // Backlog features as planned tasks
    for (const feature of features.filter((f) => f.stage === "backlog").slice(0, 5)) {
      items.push({
        id: `feature:${feature.id}`,
        label: feature.name,
        status: "pending",
        source: "feature",
        detail: "Backlog",
      });
    }

    // Recently done features
    for (const feature of features.filter((f) => f.stage === "done").slice(-3)) {
      items.push({
        id: `feature:${feature.id}`,
        label: feature.name,
        status: "done",
        source: "feature",
      });
    }

    return items;
  }, [threads, features, goals, projectId]);

  const activeCount = tasks.filter((t) => t.status === "active").length;
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  if (tasks.length === 0) return null;

  return (
    <div className="border-b border-border/40">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <ListChecksIcon className="size-3.5 text-muted-foreground/60" />
          <span className="text-xs font-medium text-foreground/80">Tasks</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground/40">
          {activeCount > 0 && (
            <span className="text-emerald-400">{activeCount} active</span>
          )}
          {pendingCount > 0 && <span>{pendingCount} planned</span>}
          {doneCount > 0 && <span className="text-muted-foreground/30">{doneCount} done</span>}
        </div>
      </div>

      <div className="pb-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "flex items-start gap-2 px-3 py-1 text-xs",
              task.status === "done" && "opacity-40",
            )}
          >
            {task.status === "active" && (
              <Loader2Icon className="size-3 mt-0.5 shrink-0 text-emerald-400 animate-spin" />
            )}
            {task.status === "pending" && (
              <CircleIcon className="size-3 mt-0.5 shrink-0 text-muted-foreground/30" />
            )}
            {task.status === "done" && (
              <CheckCircleIcon className="size-3 mt-0.5 shrink-0 text-emerald-500/50" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate",
                  task.status === "active"
                    ? "text-foreground/90 font-medium"
                    : task.status === "done"
                      ? "text-muted-foreground/50 line-through"
                      : "text-foreground/70",
                )}
              >
                {task.label}
              </p>
              {task.detail && (
                <p className="text-[9px] text-muted-foreground/40 truncate">{task.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

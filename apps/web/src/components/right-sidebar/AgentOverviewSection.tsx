/**
 * AgentOverviewSection — Shows all active and recent agents for a project.
 *
 * Displays which agents are running, what features they're working on,
 * and alerts about file conflicts between agents.
 */
import { useState, useCallback, useEffect } from "react";
import {
  BotIcon,
  AlertTriangleIcon,
  CircleDotIcon,
  CheckCircleIcon,
  XCircleIcon,
  Loader2Icon,
} from "lucide-react";
import type { ProjectId } from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";
import { cn } from "~/lib/utils";
import { useNavigate } from "@tanstack/react-router";

interface AgentStatus {
  threadId: string;
  threadTitle: string;
  featureName: string | null;
  status: "idle" | "running" | "completed" | "error";
  provider: string | null;
  model: string | null;
  lastActivity: string | null;
  turnCount: number;
}

interface FileConflict {
  filePath: string;
  threads: string[];
}

const STATUS_CONFIG = {
  running: {
    icon: Loader2Icon,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    label: "Running",
    animate: true,
  },
  completed: {
    icon: CheckCircleIcon,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    label: "Done",
    animate: false,
  },
  error: {
    icon: XCircleIcon,
    color: "text-red-400",
    bg: "bg-red-500/10",
    label: "Error",
    animate: false,
  },
  idle: {
    icon: CircleDotIcon,
    color: "text-muted-foreground/40",
    bg: "bg-muted/10",
    label: "Idle",
    animate: false,
  },
} as const;

export function AgentOverviewSection({ projectId }: { projectId: ProjectId }) {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [conflicts, setConflicts] = useState<FileConflict[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOverview = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    try {
      const result = await api.agents.getOverview({ projectId });
      const overview = result.overview as any;
      setAgents(overview.agents ?? []);
      setConflicts(overview.conflicts ?? []);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchOverview();
    // Poll every 5 seconds when agents might be running
    const interval = setInterval(() => void fetchOverview(), 5000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  if (isLoading) return null;
  if (agents.length === 0) return null;

  const runningCount = agents.filter((a) => a.status === "running").length;

  return (
    <div className="border-b border-border/40">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <BotIcon className="size-3.5 text-muted-foreground/60" />
          <span className="text-xs font-medium text-foreground/80">
            Agents ({agents.length})
          </span>
          {runningCount > 0 && (
            <span className="text-[10px] text-emerald-400 font-medium">
              {runningCount} running
            </span>
          )}
        </div>
      </div>

      {/* Conflicts warning */}
      {conflicts.length > 0 && (
        <div className="mx-3 mb-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangleIcon className="size-3 text-amber-400 shrink-0" />
            <span className="text-[10px] text-amber-400 font-medium">
              File conflicts detected
            </span>
          </div>
          {conflicts.map((c) => (
            <p key={c.filePath} className="text-[9px] text-amber-400/60 mt-0.5 pl-4">
              {c.filePath} — modified by {c.threads.join(", ")}
            </p>
          ))}
        </div>
      )}

      {/* Agent list */}
      {agents.map((agent) => {
        const config = STATUS_CONFIG[agent.status];
        const Icon = config.icon;
        return (
          <div
            key={agent.threadId}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/10 cursor-pointer"
            onClick={() => void navigate({ to: "/$threadId", params: { threadId: agent.threadId } })}
            title="Click to open this thread"
          >
            <Icon
              className={cn(
                "size-3 shrink-0",
                config.color,
                config.animate && "animate-spin",
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-foreground/80 truncate">{agent.threadTitle}</p>
              {agent.featureName && (
                <p className="text-[9px] text-muted-foreground/50 truncate">
                  {agent.featureName}
                </p>
              )}
            </div>
            <span className="text-[9px] text-muted-foreground/40 shrink-0">
              {agent.turnCount}T
            </span>
          </div>
        );
      })}
    </div>
  );
}

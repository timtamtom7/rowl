import {
  ChevronDownIcon,
  ChevronRightIcon,
  GitBranchIcon,
  GitMergeIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  ScissorsIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { cn } from "~/lib/utils";
import { WorktreeCheckpointPanel } from "./WorktreeCheckpointPanel";
import { useWorktrees, type WorktreesController } from "./useWorktrees";

export function WorktreePanel({
  cwd,
  controller,
}: {
  readonly cwd: string | null | undefined;
  readonly controller?: WorktreesController;
}) {
  const liveController = useWorktrees({ cwd });
  const worktrees = controller ?? liveController;
  const [branch, setBranch] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [busyBranch, setBusyBranch] = useState<string | null>(null);
  const [expandedBranches, setExpandedBranches] = useState<ReadonlySet<string>>(() => new Set());

  const createWorktree = async () => {
    const nextBranch = branch.trim();
    if (!nextBranch) return;
    setIsCreating(true);
    try {
      await worktrees.create({
        branch: nextBranch,
        ...(baseBranch.trim() ? { baseBranch: baseBranch.trim() } : {}),
      });
      setBranch("");
      setBaseBranch("");
    } finally {
      setIsCreating(false);
    }
  };

  const removeWorktree = (branchName: string) => {
    const ok =
      typeof window === "undefined" ||
      window.confirm(`Remove worktree for branch "${branchName}"?`);
    if (ok) {
      void worktrees.remove(branchName, false);
    }
  };

  const integrate = async (branchName: string, mode: "cherry-pick" | "merge") => {
    setBusyBranch(`${mode}:${branchName}`);
    try {
      if (mode === "cherry-pick") {
        await worktrees.cherryPick({ sourceRef: branchName, targetBranch: "main" });
      } else {
        await worktrees.merge({ branch: branchName, targetBranch: "main" });
      }
    } finally {
      setBusyBranch(null);
    }
  };

  const cherryPickCheckpoint = async (checkpointRef: string) => {
    setBusyBranch(`checkpoint:${checkpointRef}`);
    try {
      await worktrees.cherryPick({ sourceRef: checkpointRef, targetBranch: "main" });
    } finally {
      setBusyBranch(null);
    }
  };

  const toggleExpanded = (branchName: string) => {
    setExpandedBranches((current) => {
      const next = new Set(current);
      if (next.has(branchName)) {
        next.delete(branchName);
      } else {
        next.add(branchName);
      }
      return next;
    });
  };

  return (
    <section className="flex min-h-0 flex-col border-b border-border/40">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
          <span className="text-xs font-medium text-foreground/80">Worktrees</span>
        </div>
        <button
          type="button"
          onClick={() => void worktrees.refresh()}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground/55 hover:bg-accent/50 hover:text-foreground/80"
          aria-label="Refresh worktrees"
        >
          <RefreshCwIcon className="size-3" />
        </button>
      </div>

      <div className="space-y-2 px-3 pb-3">
        {!cwd ? (
          <div className="rounded-md border border-border/50 bg-muted/15 px-2 py-2 text-[11px] text-muted-foreground/60">
            Select a project folder to manage worktrees.
          </div>
        ) : null}

        {worktrees.isLoading ? (
          <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground/55">
            <Loader2Icon className="size-3 animate-spin" />
            Loading worktrees...
          </div>
        ) : null}

        {worktrees.error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
            {worktrees.error}
          </div>
        ) : null}

        {cwd && worktrees.worktrees.length === 0 ? (
          <div className="rounded-md border border-border/50 bg-muted/15 px-2 py-2 text-[11px] text-muted-foreground/60">
            No managed worktrees.
          </div>
        ) : null}

        <div className="space-y-1">
          {worktrees.worktrees.map((worktree) => (
            <div key={worktree.path} className="rounded-md border border-border/50 bg-muted/10 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(worktree.branch)}
                    className="flex max-w-full items-center gap-1.5 text-left hover:text-foreground"
                    aria-expanded={expandedBranches.has(worktree.branch)}
                    aria-label={`Toggle checkpoints for ${worktree.branch}`}
                  >
                    {expandedBranches.has(worktree.branch) ? (
                      <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground/45" />
                    ) : (
                      <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground/45" />
                    )}
                    <GitBranchIcon className="size-3 shrink-0 text-muted-foreground/45" />
                    <span className="truncate text-[12px] font-medium">{worktree.branch}</span>
                    {worktree.isLocked ? (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-500">
                        locked
                      </span>
                    ) : null}
                  </button>
                  <div className="mt-0.5 truncate text-[9px] text-muted-foreground/50">
                    {worktree.path}
                  </div>
                  <div className="mt-0.5 truncate text-[9px] text-muted-foreground/45">
                    {worktree.head}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeWorktree(worktree.branch)}
                  aria-label={`Remove worktree ${worktree.branch}`}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/45 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2Icon className="size-3" />
                </button>
              </div>
              <div className="mt-2 flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => void integrate(worktree.branch, "cherry-pick")}
                  disabled={busyBranch !== null}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground/80",
                    busyBranch === `cherry-pick:${worktree.branch}` && "opacity-70",
                  )}
                >
                  {busyBranch === `cherry-pick:${worktree.branch}` ? (
                    <Loader2Icon className="size-3 animate-spin" />
                  ) : (
                    <ScissorsIcon className="size-3" />
                  )}
                  Cherry-pick
                </button>
                <button
                  type="button"
                  onClick={() => void integrate(worktree.branch, "merge")}
                  disabled={busyBranch !== null}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-60",
                    busyBranch === `merge:${worktree.branch}` && "opacity-80",
                  )}
                >
                  {busyBranch === `merge:${worktree.branch}` ? (
                    <Loader2Icon className="size-3 animate-spin" />
                  ) : (
                    <GitMergeIcon className="size-3" />
                  )}
                  Merge
                </button>
              </div>
              {expandedBranches.has(worktree.branch) ? (
                <WorktreeCheckpointPanel
                  cwd={cwd}
                  worktreeBranch={worktree.branch}
                  onCherryPickCheckpoint={cherryPickCheckpoint}
                  onMergeWorktreeBranch={(branchName) => integrate(branchName, "merge")}
                />
              ) : null}
            </div>
          ))}
        </div>

        <div className="space-y-1.5 rounded-md border border-border/50 bg-muted/10 p-2">
          <input
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createWorktree();
            }}
            placeholder="Branch name"
            className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[11px]"
          />
          <input
            value={baseBranch}
            onChange={(event) => setBaseBranch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createWorktree();
            }}
            placeholder="Base branch (optional)"
            className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[10px]"
          />
          <button
            type="button"
            onClick={() => void createWorktree()}
            disabled={!cwd || !branch.trim() || isCreating}
            className="flex h-7 w-full items-center justify-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {isCreating ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <PlusIcon className="size-3" />
            )}
            Create Worktree
          </button>
        </div>
      </div>
    </section>
  );
}

import {
  GitCommitIcon,
  GitMergeIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  ScissorsIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import type { WorktreeCheckpoint } from "@t3tools/contracts";

import { cn } from "~/lib/utils";
import {
  useWorktreeCheckpoints,
  type WorktreeCheckpointsController,
} from "./useWorktreeCheckpoints";

function shortSha(value: string): string {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function checkpointLabel(checkpoint: WorktreeCheckpoint): string {
  const parts = checkpoint.checkpointRef.split("/");
  return parts.at(-1) || checkpoint.checkpointRef;
}

export function WorktreeCheckpointPanel({
  cwd,
  worktreeBranch,
  controller,
  onCherryPickCheckpoint,
  onMergeWorktreeBranch,
}: {
  readonly cwd: string | null | undefined;
  readonly worktreeBranch: string;
  readonly controller?: WorktreeCheckpointsController;
  readonly onCherryPickCheckpoint: (checkpointRef: string) => Promise<void>;
  readonly onMergeWorktreeBranch: (branch: string) => Promise<void>;
}) {
  const liveController = useWorktreeCheckpoints(worktreeBranch, { cwd });
  const checkpoints = controller ?? liveController;
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const createCheckpoint = async () => {
    setIsCreating(true);
    try {
      await checkpoints.createCheckpointInWorktree(
        message.trim() ? { message: message.trim() } : undefined,
      );
      setMessage("");
      setShowForm(false);
    } finally {
      setIsCreating(false);
    }
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await action();
      await checkpoints.refresh();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="mt-2 border-t border-border/40 pt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-foreground/75">
          <GitCommitIcon className="size-3 text-muted-foreground/50" />
          <span>Checkpoints</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void checkpoints.refresh()}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground/55 hover:bg-accent/50 hover:text-foreground/80"
            aria-label={`Refresh checkpoints for ${worktreeBranch}`}
          >
            <RefreshCwIcon className={cn("size-3", checkpoints.isLoading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="flex h-6 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground/80"
          >
            {showForm ? <XIcon className="size-3" /> : <PlusIcon className="size-3" />}
            {showForm ? "Cancel" : "New"}
          </button>
          <button
            type="button"
            onClick={() =>
              void runAction(`merge:${worktreeBranch}`, () => onMergeWorktreeBranch(worktreeBranch))
            }
            disabled={busyAction !== null}
            className={cn(
              "flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-60",
              busyAction === `merge:${worktreeBranch}` && "opacity-80",
            )}
          >
            {busyAction === `merge:${worktreeBranch}` ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <GitMergeIcon className="size-3" />
            )}
            Merge
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="mt-2 flex gap-1.5">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createCheckpoint();
            }}
            placeholder="Checkpoint message"
            className="h-7 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 text-[11px]"
          />
          <button
            type="button"
            onClick={() => void createCheckpoint()}
            disabled={!cwd || isCreating}
            className="flex h-7 shrink-0 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {isCreating ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <PlusIcon className="size-3" />
            )}
            Save
          </button>
        </div>
      ) : null}

      {checkpoints.error ? (
        <div className="mt-2 rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {checkpoints.error}
        </div>
      ) : null}

      {checkpoints.isLoading && checkpoints.checkpoints.length === 0 ? (
        <div className="mt-2 flex items-center gap-2 py-1 text-[11px] text-muted-foreground/55">
          <Loader2Icon className="size-3 animate-spin" />
          Loading checkpoints...
        </div>
      ) : null}

      {!checkpoints.isLoading && checkpoints.checkpoints.length === 0 ? (
        <div className="mt-2 rounded-md border border-border/40 bg-background/40 px-2 py-2 text-[11px] text-muted-foreground/60">
          No checkpoints yet.
        </div>
      ) : null}

      {checkpoints.checkpoints.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {checkpoints.checkpoints.map((checkpoint) => (
            <div
              key={checkpoint.checkpointRef}
              className="rounded-md border border-border/40 bg-background/45 px-2 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <GitCommitIcon className="size-3 shrink-0 text-muted-foreground/45" />
                    <span className="truncate text-[11px] font-medium">
                      {checkpointLabel(checkpoint)}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-muted-foreground/65">
                    {checkpoint.message ?? "Checkpoint"}
                  </div>
                  <div className="mt-1 grid gap-0.5 text-[9px] text-muted-foreground/45">
                    <span className="truncate">head {shortSha(checkpoint.head)}</span>
                    <span className="truncate">{formatCreatedAt(checkpoint.createdAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void runAction(`cherry-pick:${checkpoint.checkpointRef}`, () =>
                      onCherryPickCheckpoint(checkpoint.checkpointRef),
                    )
                  }
                  disabled={busyAction !== null}
                  aria-label={`Cherry-pick checkpoint ${checkpoint.checkpointRef} to main`}
                  className={cn(
                    "flex h-7 shrink-0 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground/80 disabled:opacity-60",
                    busyAction === `cherry-pick:${checkpoint.checkpointRef}` && "opacity-70",
                  )}
                >
                  {busyAction === `cherry-pick:${checkpoint.checkpointRef}` ? (
                    <Loader2Icon className="size-3 animate-spin" />
                  ) : (
                    <ScissorsIcon className="size-3" />
                  )}
                  To main
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

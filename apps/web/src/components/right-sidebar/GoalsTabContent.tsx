import { useState, useCallback } from "react";
import { PlusIcon, StarIcon, Trash2Icon, CheckIcon, XIcon, LinkIcon } from "lucide-react";
import type { ProjectId } from "@t3tools/contracts";

import { cn } from "~/lib/utils";
import { useStore } from "~/store";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useSidebarGoals, useSidebarFeatures } from "~/lib/sidebarReactQuery";
import { useRightSidebar } from "./RightSidebarContext";

export function GoalsTabContent({ projectId }: { projectId: ProjectId }) {
  const { goals, isLoading, createGoal, updateGoalText, setMainGoal, deleteGoal } =
    useSidebarGoals(projectId);
  const { features } = useSidebarFeatures(projectId);
  const threads = useStore((store) => store.threads);
  const { navigateToTab } = useRightSidebar();

  // Calculate feature progress for display
  const totalFeatures = features.length;
  const doneFeatures = features.filter((f) => f.stage === "done").length;
  const inProgressFeatures = features.filter((f) => f.stage === "in_progress").length;
  const progressPercent = totalFeatures > 0 ? Math.round((doneFeatures / totalFeatures) * 100) : 0;
  const [newGoalText, setNewGoalText] = useState("");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const handleCreate = useCallback(() => {
    const text = newGoalText.trim();
    if (!text) return;
    const isMain = goals.length === 0;
    createGoal.mutate({ text, isMain });
    setNewGoalText("");
  }, [newGoalText, goals.length, createGoal]);

  const handleUpdateText = useCallback(
    (goalId: string) => {
      const text = editingText.trim();
      if (!text) return;
      updateGoalText.mutate({ id: goalId, text });
      setEditingGoalId(null);
    },
    [editingText, updateGoalText],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading goals...
      </div>
    );
  }

  const mainGoal = goals.find((g) => g.isMain);
  const subGoals = goals.filter((g) => !g.isMain);
  const projectThreads = threads.filter((t) => t.projectId === projectId);

  return (
    <div className="flex flex-col">
      {/* Main goal */}
      {mainGoal ? (
        <div className="border-b border-border/40 bg-accent/20 px-3 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <StarIcon className="size-3.5 fill-amber-500 text-amber-500" />
            <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium">
              Main Goal
            </span>
          </div>
          {editingGoalId === mainGoal.id ? (
            <div className="flex items-center gap-1">
              <Input
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateText(mainGoal.id);
                  if (e.key === "Escape") setEditingGoalId(null);
                }}
                className="text-sm h-7"
                autoFocus
              />
              <Button size="xs" variant="ghost" onClick={() => handleUpdateText(mainGoal.id)}>
                <CheckIcon className="size-3" />
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setEditingGoalId(null)}>
                <XIcon className="size-3" />
              </Button>
            </div>
          ) : (
            <p
              className="text-sm font-medium text-foreground cursor-pointer hover:text-foreground/80"
              onClick={() => {
                setEditingGoalId(mainGoal.id);
                setEditingText(mainGoal.text);
              }}
            >
              {mainGoal.text}
            </p>
          )}

          {/* Feature progress under main goal */}
          {totalFeatures > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[9px] text-muted-foreground/50 mb-1">
                <span>
                  {doneFeatures}/{totalFeatures} features done
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500/60 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {inProgressFeatures > 0 && (
                <p className="text-[9px] text-sky-400/60 mt-0.5">
                  {inProgressFeatures} in progress
                </p>
              )}
            </div>
          )}

          {/* Linked threads */}
          {mainGoal.linkedThreadIds && mainGoal.linkedThreadIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {mainGoal.linkedThreadIds.map((tid) => {
                const thread = projectThreads.find((t) => t.id === tid);
                if (!thread) return null;
                return (
                  <button
                    key={tid}
                    type="button"
                    onClick={() => navigateToTab("threads", { type: "thread", id: tid })}
                    className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary hover:bg-primary/20 transition-colors"
                  >
                    <LinkIcon className="size-2" />
                    {thread.title.slice(0, 20)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : goals.length > 0 ? (
        <div className="border-b border-border/40 px-3 py-3">
          <p className="text-xs text-muted-foreground/60 italic">
            No main goal set. Click the star on a goal to make it the main goal.
          </p>
        </div>
      ) : null}

      {/* Sub-goals */}
      {subGoals.map((goal) => (
        <div
          key={goal.id}
          className="flex items-start gap-2 px-3 py-2.5 border-b border-border/40 group hover:bg-accent/15"
        >
          <button
            type="button"
            onClick={() => setMainGoal.mutate({ id: goal.id, isMain: true })}
            className="mt-0.5 text-muted-foreground/30 hover:text-amber-500 transition-colors"
            title="Set as main goal"
          >
            <StarIcon className="size-3.5" />
          </button>

          <div className="flex-1 min-w-0">
            {editingGoalId === goal.id ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdateText(goal.id);
                    if (e.key === "Escape") setEditingGoalId(null);
                  }}
                  className="text-xs h-6"
                  autoFocus
                />
                <Button size="xs" variant="ghost" onClick={() => handleUpdateText(goal.id)}>
                  <CheckIcon className="size-3" />
                </Button>
              </div>
            ) : (
              <p
                className="text-xs text-foreground/80 cursor-pointer hover:text-foreground"
                onClick={() => {
                  setEditingGoalId(goal.id);
                  setEditingText(goal.text);
                }}
              >
                {goal.text}
              </p>
            )}

            {/* Linked threads */}
            {goal.linkedThreadIds && goal.linkedThreadIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {goal.linkedThreadIds.map((tid) => {
                  const thread = projectThreads.find((t) => t.id === tid);
                  if (!thread) return null;
                  return (
                    <button
                      key={tid}
                      type="button"
                      onClick={() => navigateToTab("threads", { type: "thread", id: tid })}
                      className="inline-flex items-center gap-0.5 rounded bg-muted/30 px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      <LinkIcon className="size-2" />
                      {thread.title.slice(0, 15)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => deleteGoal.mutate(goal.id)}
            className="mt-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
            title="Delete goal"
          >
            <Trash2Icon className="size-3" />
          </button>
        </div>
      ))}

      {/* Empty state */}
      {goals.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">No goals yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Goals help you and the AI stay focused on what matters.
          </p>
        </div>
      )}

      {/* Add goal */}
      <div className="px-3 py-2 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <Input
            value={newGoalText}
            onChange={(e) => setNewGoalText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="Add a goal..."
            className="text-xs h-7 flex-1"
          />
          <Button
            size="xs"
            variant="outline"
            className="h-7"
            onClick={handleCreate}
            disabled={!newGoalText.trim() || createGoal.isPending}
          >
            <PlusIcon className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

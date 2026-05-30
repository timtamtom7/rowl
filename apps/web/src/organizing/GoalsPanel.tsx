import { ChevronRightIcon, CircleDotIcon, Loader2Icon, PlusIcon, TargetIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { Goal, GoalId, GoalLevel, GoalStatus, ProjectId } from "@t3tools/contracts";

import { cn } from "~/lib/utils";
import { useGoals, type GoalsController } from "./useGoals";

const GOAL_STATUSES: ReadonlyArray<GoalStatus> = ["planned", "active", "achieved", "cancelled"];
const GOAL_LEVELS: ReadonlyArray<GoalLevel> = ["company", "team", "agent", "task"];

export function GoalsPanel({
  projectId,
  controller,
  selectedGoalId,
  onSelectedGoalIdChange,
}: {
  readonly projectId: ProjectId | null | undefined;
  readonly controller?: GoalsController;
  readonly selectedGoalId?: GoalId | null | undefined;
  readonly onSelectedGoalIdChange?: (goalId: GoalId | null) => void;
}) {
  const liveController = useGoals({ projectId });
  const goals = controller ?? liveController;
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [draftText, setDraftText] = useState("");
  const [draftParentId, setDraftParentId] = useState<string>("");
  const [draftStatus, setDraftStatus] = useState<GoalStatus>("planned");
  const [draftLevel, setDraftLevel] = useState<GoalLevel>("task");
  const [isCreating, setIsCreating] = useState(false);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const goal of goals.goals) {
      const key = goal.parentId ?? "root";
      map.set(key, [...(map.get(key) ?? []), goal]);
    }
    for (const children of map.values()) {
      children.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return map;
  }, [goals.goals]);

  const selectedGoal = goals.goals.find((goal) => goal.id === selectedGoalId) ?? null;

  const createGoal = async () => {
    const text = draftText.trim();
    if (!text) return;
    setIsCreating(true);
    try {
      const goal = await goals.create({
        text,
        isMain: goals.goals.length === 0,
        status: draftStatus,
        level: draftLevel,
        ...(draftParentId ? { parentId: draftParentId as GoalId } : {}),
      });
      setDraftText("");
      setDraftParentId("");
      onSelectedGoalIdChange?.(goal.id);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleExpanded = async (goalId: GoalId) => {
    await goals.getChildren(goalId);
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  return (
    <section className="flex min-h-0 flex-col border-b border-border/40">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <TargetIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
          <span className="text-xs font-medium text-foreground/80">Goals</span>
          {selectedGoal ? (
            <span className="max-w-[160px] truncate text-[10px] text-muted-foreground/55">
              {selectedGoal.text}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void goals.refresh()}
          className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:bg-accent/50 hover:text-foreground/80"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-2 px-3 pb-3">
        {goals.isLoading ? (
          <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground/55">
            <Loader2Icon className="size-3 animate-spin" />
            Loading goals...
          </div>
        ) : null}

        {goals.error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
            {goals.error}
          </div>
        ) : null}

        {!goals.isLoading && goals.goals.length === 0 ? (
          <div className="rounded-md border border-border/50 bg-muted/15 px-2 py-2 text-[11px] text-muted-foreground/60">
            No goals yet.
          </div>
        ) : (
          <div className="space-y-1">
            {(childrenByParent.get("root") ?? []).map((goal) => (
              <GoalTreeNode
                key={goal.id}
                goal={goal}
                depth={0}
                childrenByParent={childrenByParent}
                expandedIds={expandedIds}
                selectedGoalId={selectedGoalId ?? null}
                onSelect={(id) => onSelectedGoalIdChange?.(id)}
                onToggle={(id) => void toggleExpanded(id)}
                onUpdate={(input) => void goals.update(input)}
              />
            ))}
          </div>
        )}

        <div className="space-y-1.5 rounded-md border border-border/50 bg-muted/10 p-2">
          <input
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createGoal();
            }}
            placeholder="New goal..."
            className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[11px]"
          />
          <div className="grid grid-cols-3 gap-1.5">
            <select
              value={draftParentId}
              onChange={(event) => setDraftParentId(event.target.value)}
              className="h-7 min-w-0 rounded-md border border-border/60 bg-background px-1.5 text-[10px]"
            >
              <option value="">No parent</option>
              {goals.goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.text}
                </option>
              ))}
            </select>
            <select
              value={draftStatus}
              onChange={(event) => setDraftStatus(event.target.value as GoalStatus)}
              className="h-7 min-w-0 rounded-md border border-border/60 bg-background px-1.5 text-[10px]"
            >
              {GOAL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={draftLevel}
              onChange={(event) => setDraftLevel(event.target.value as GoalLevel)}
              className="h-7 min-w-0 rounded-md border border-border/60 bg-background px-1.5 text-[10px]"
            >
              {GOAL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void createGoal()}
            disabled={isCreating || !draftText.trim()}
            className="flex h-7 w-full items-center justify-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {isCreating ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <PlusIcon className="size-3" />
            )}
            Create Goal
          </button>
        </div>
      </div>
    </section>
  );
}

function GoalTreeNode({
  goal,
  depth,
  childrenByParent,
  expandedIds,
  selectedGoalId,
  onSelect,
  onToggle,
  onUpdate,
}: {
  readonly goal: Goal;
  readonly depth: number;
  readonly childrenByParent: ReadonlyMap<string, ReadonlyArray<Goal>>;
  readonly expandedIds: ReadonlySet<string>;
  readonly selectedGoalId: GoalId | null;
  readonly onSelect: (goalId: GoalId) => void;
  readonly onToggle: (goalId: GoalId) => void;
  readonly onUpdate: (input: {
    readonly id: GoalId;
    readonly status?: GoalStatus;
    readonly level?: GoalLevel;
  }) => void;
}) {
  const children = childrenByParent.get(goal.id) ?? [];
  const isExpanded = expandedIds.has(goal.id);
  const isSelected = selectedGoalId === goal.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md px-1.5 py-1.5 transition-colors",
          isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/45",
        )}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
      >
        <button
          type="button"
          onClick={() => onToggle(goal.id)}
          disabled={children.length === 0}
          aria-label={isExpanded ? "Collapse goal" : "Expand goal"}
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/55 hover:bg-accent/50 disabled:opacity-25"
        >
          <ChevronRightIcon
            className={cn("size-3 transition-transform", isExpanded && "rotate-90")}
          />
        </button>
        <button
          type="button"
          onClick={() => onSelect(goal.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <CircleDotIcon className="size-3 shrink-0 text-muted-foreground/45" />
          <span className="truncate text-[12px] font-medium">{goal.text}</span>
        </button>
        <StatusBadge status={goal.status} />
        <LevelBadge level={goal.level} />
        <select
          aria-label={`Status for ${goal.text}`}
          value={goal.status}
          onChange={(event) => onUpdate({ id: goal.id, status: event.target.value as GoalStatus })}
          className="h-6 w-[82px] rounded-md border border-border/50 bg-background px-1 text-[10px]"
        >
          {GOAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          aria-label={`Level for ${goal.text}`}
          value={goal.level}
          onChange={(event) => onUpdate({ id: goal.id, level: event.target.value as GoalLevel })}
          className="h-6 w-[74px] rounded-md border border-border/50 bg-background px-1 text-[10px]"
        >
          {GOAL_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>
      {isExpanded
        ? children.map((child) => (
            <GoalTreeNode
              key={child.id}
              goal={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              expandedIds={expandedIds}
              selectedGoalId={selectedGoalId}
              onSelect={onSelect}
              onToggle={onToggle}
              onUpdate={onUpdate}
            />
          ))
        : null}
    </div>
  );
}

function StatusBadge({ status }: { readonly status: GoalStatus }) {
  return (
    <span className="hidden rounded bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground/70 min-[380px]:inline">
      {status}
    </span>
  );
}

function LevelBadge({ level }: { readonly level: GoalLevel }) {
  return (
    <span className="hidden rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary/75 min-[420px]:inline">
      {level}
    </span>
  );
}

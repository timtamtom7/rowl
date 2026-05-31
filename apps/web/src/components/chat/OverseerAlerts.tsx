/**
 * OverseerAlerts — Shows AI oversight warnings in the chat timeline.
 *
 * Renders visual alerts when the Overseer detects:
 * - Premature completion claims ("AI says done without proof")
 * - Uncertainty/hedging ("AI isn't sure about this")
 * - Technical delegation ("AI asking you to run commands")
 * - Dangerous commands ("Destructive operation detected")
 * - Context budget warnings ("Context is filling up")
 * - Loop detection ("AI stuck repeating the same error")
 *
 * Each alert type has a distinct visual treatment so non-coders
 * can quickly understand what needs attention.
 */
import { memo } from "react";
import {
  AlertTriangleIcon,
  ShieldAlertIcon,
  HelpCircleIcon,
  CheckCircleIcon,
  TerminalIcon,
  RepeatIcon,
  BrainIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";

interface OverseerActivity {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}

const ALERT_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
  }
> = {
  "overseer.premature-completion": {
    icon: CheckCircleIcon,
    color: "text-amber-400",
    bgColor: "bg-amber-500/8",
    borderColor: "border-amber-500/20",
    label: "Verify Before Moving On",
  },
  "overseer.certainty-warning": {
    icon: HelpCircleIcon,
    color: "text-blue-400",
    bgColor: "bg-blue-500/8",
    borderColor: "border-blue-500/20",
    label: "AI Uncertainty",
  },
  "overseer.capability-forgetfulness": {
    icon: BrainIcon,
    color: "text-violet-400",
    bgColor: "bg-violet-500/8",
    borderColor: "border-violet-500/20",
    label: "AI Forgot Its Capabilities",
  },
  "overseer.technical-delegation": {
    icon: TerminalIcon,
    color: "text-orange-400",
    bgColor: "bg-orange-500/8",
    borderColor: "border-orange-500/20",
    label: "AI Asking You To Do Tech Work",
  },
  "overseer.dangerous-command": {
    icon: ShieldAlertIcon,
    color: "text-red-400",
    bgColor: "bg-red-500/8",
    borderColor: "border-red-500/20",
    label: "Dangerous Operation",
  },
  "overseer.loop-detected": {
    icon: RepeatIcon,
    color: "text-red-400",
    bgColor: "bg-red-500/8",
    borderColor: "border-red-500/20",
    label: "AI Stuck In Loop",
  },
  "overseer.context-budget-high": {
    icon: AlertTriangleIcon,
    color: "text-amber-400",
    bgColor: "bg-amber-500/8",
    borderColor: "border-amber-500/20",
    label: "Context Getting Full",
  },
  "overseer.context-exhaustion": {
    icon: AlertTriangleIcon,
    color: "text-red-400",
    bgColor: "bg-red-500/8",
    borderColor: "border-red-500/20",
    label: "Context Nearly Exhausted",
  },
  "overseer.session-error": {
    icon: ShieldAlertIcon,
    color: "text-red-400",
    bgColor: "bg-red-500/8",
    borderColor: "border-red-500/20",
    label: "Session Error",
  },
  "overseer.evaluation-result": {
    icon: CheckCircleIcon,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/8",
    borderColor: "border-cyan-500/20",
    label: "Evaluator Check",
  },
};

const DEFAULT_CONFIG = {
  icon: AlertTriangleIcon,
  color: "text-muted-foreground",
  bgColor: "bg-muted/10",
  borderColor: "border-border/40",
  label: "Notice",
};

export const OverseerAlert = memo(function OverseerAlert({
  activity,
}: {
  activity: OverseerActivity;
}) {
  const config = ALERT_CONFIG[activity.kind] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  return (
    <div
      className={cn("mx-4 my-2 rounded-lg border px-3 py-2", config.bgColor, config.borderColor)}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn("size-4 shrink-0 mt-0.5", config.color)} />
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider mb-0.5",
              config.color,
            )}
          >
            {config.label}
          </p>
          <p className="text-xs text-foreground/70 leading-relaxed">
            {activity.summary.replace(/^Overseer:\s*/i, "")}
          </p>
        </div>
      </div>
    </div>
  );
});

/**
 * Filter overseer activities from a thread's activity list
 * and return them sorted by creation time.
 */
export function getOverseerAlerts(
  activities: ReadonlyArray<{
    id?: string;
    kind?: string;
    summary?: string;
    createdAt?: string;
    [key: string]: unknown;
  }>,
): OverseerActivity[] {
  return activities
    .filter((a) => typeof a.kind === "string" && a.kind.startsWith("overseer."))
    .map((a) => ({
      id: (a.id as string) ?? "",
      kind: a.kind as string,
      summary: (a.summary as string) ?? "",
      createdAt: (a.createdAt as string) ?? "",
      payload: (a.payload as Record<string, unknown>) ?? {},
    }))
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

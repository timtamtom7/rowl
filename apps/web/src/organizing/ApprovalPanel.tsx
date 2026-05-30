import {
  CheckIcon,
  CircleSlashIcon,
  ClipboardCheckIcon,
  Loader2Icon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import type { ApprovalGate, ApprovalGateId, GoalId } from "@t3tools/contracts";

import { cn } from "~/lib/utils";
import { useApprovals, type ApprovalsController } from "./useApprovals";

export function ApprovalPanel({
  goalId,
  controller,
}: {
  readonly goalId: GoalId | null | undefined;
  readonly controller?: ApprovalsController;
}) {
  const liveController = useApprovals({ goalId });
  const approvals = controller ?? liveController;
  const [requestedBy, setRequestedBy] = useState("user");
  const [reason, setReason] = useState("");
  const [reviewReasonById, setReviewReasonById] = useState<Record<string, string>>({});
  const [reviewedBy, setReviewedBy] = useState("user");
  const [isCreating, setIsCreating] = useState(false);

  const createApproval = async () => {
    if (!goalId || !requestedBy.trim()) return;
    setIsCreating(true);
    try {
      await approvals.create({
        requestedBy: requestedBy.trim(),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setReason("");
    } finally {
      setIsCreating(false);
    }
  };

  const review = (approval: ApprovalGate, decision: "approve" | "reject") => {
    const input = {
      approvalId: approval.id,
      reviewedBy: reviewedBy.trim() || "user",
      ...(reviewReasonById[approval.id]?.trim()
        ? { reason: reviewReasonById[approval.id]?.trim() }
        : {}),
    };
    if (decision === "approve") {
      void approvals.approve(input);
    } else {
      void approvals.reject(input);
    }
  };

  return (
    <section className="flex min-h-0 flex-col border-b border-border/40">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <ClipboardCheckIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
          <span className="text-xs font-medium text-foreground/80">Approvals</span>
          {goalId ? (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px]",
                approvals.isApproved
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-muted/35 text-muted-foreground/65",
              )}
            >
              {approvals.isApproved ? "approved" : "gated"}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void approvals.refresh()}
          className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:bg-accent/50 hover:text-foreground/80"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-2 px-3 pb-3">
        {!goalId ? (
          <div className="rounded-md border border-border/50 bg-muted/15 px-2 py-2 text-[11px] text-muted-foreground/60">
            Select a goal to manage approval gates.
          </div>
        ) : null}

        {approvals.isLoading ? (
          <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground/55">
            <Loader2Icon className="size-3 animate-spin" />
            Loading approvals...
          </div>
        ) : null}

        {approvals.error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
            {approvals.error}
          </div>
        ) : null}

        {goalId && approvals.approvals.length === 0 ? (
          <div className="rounded-md border border-border/50 bg-muted/15 px-2 py-2 text-[11px] text-muted-foreground/60">
            No approval gates for this goal.
          </div>
        ) : null}

        <div className="space-y-1">
          {approvals.approvals.map((approval) => (
            <div key={approval.id} className="rounded-md border border-border/50 bg-muted/10 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <ApprovalStatusIcon status={approval.status} />
                    <span className="truncate text-[12px] font-medium">
                      {approval.reason ?? "Approval gate"}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[9px] text-muted-foreground/50">
                    Requested by {approval.requestedBy}
                    {approval.reviewedBy ? ` · reviewed by ${approval.reviewedBy}` : ""}
                  </div>
                </div>
                <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground/70">
                  {approval.status}
                </span>
              </div>
              {approval.status === "pending" ? (
                <div className="mt-2 space-y-1.5">
                  <input
                    value={reviewReasonById[approval.id] ?? ""}
                    onChange={(event) =>
                      setReviewReasonById((current) => ({
                        ...current,
                        [approval.id]: event.target.value,
                      }))
                    }
                    placeholder="Review reason..."
                    className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[10px]"
                  />
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => review(approval, "reject")}
                      className="flex h-7 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XIcon className="size-3" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => review(approval, "approve")}
                      className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground"
                    >
                      <CheckIcon className="size-3" />
                      Approve
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="space-y-1.5 rounded-md border border-border/50 bg-muted/10 p-2">
          <input
            value={requestedBy}
            onChange={(event) => setRequestedBy(event.target.value)}
            placeholder="Requested by"
            className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[10px]"
          />
          <input
            value={reviewedBy}
            onChange={(event) => setReviewedBy(event.target.value)}
            placeholder="Reviewed by"
            className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[10px]"
          />
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createApproval();
            }}
            placeholder="Approval gate reason..."
            className="h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[11px]"
          />
          <button
            type="button"
            onClick={() => void createApproval()}
            disabled={!goalId || !requestedBy.trim() || isCreating}
            className="flex h-7 w-full items-center justify-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {isCreating ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <PlusIcon className="size-3" />
            )}
            Create Approval Gate
          </button>
        </div>
      </div>
    </section>
  );
}

function ApprovalStatusIcon({ status }: { readonly status: ApprovalGate["status"] }) {
  if (status === "approved") return <CheckIcon className="size-3 shrink-0 text-emerald-500" />;
  if (status === "rejected") return <XIcon className="size-3 shrink-0 text-destructive" />;
  return <CircleSlashIcon className="size-3 shrink-0 text-muted-foreground/45" />;
}

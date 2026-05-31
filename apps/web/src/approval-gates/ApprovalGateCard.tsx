import type { ThreadApprovalGate } from "@t3tools/contracts";
import { CheckCircle2Icon, Clock3Icon, FileDiffIcon, XCircleIcon } from "lucide-react";
import { memo } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type ApprovalGateCardProps = {
  readonly gate: ThreadApprovalGate;
  readonly isBusy?: boolean;
  readonly onApprove: (gate: ThreadApprovalGate) => void;
  readonly onReject: (gate: ThreadApprovalGate) => void;
};

export const ApprovalGateCard = memo(function ApprovalGateCard({
  gate,
  isBusy = false,
  onApprove,
  onReject,
}: ApprovalGateCardProps) {
  const status = statusCopy(gate.status);
  const files = gate.proposedChange.files ?? [];
  const details = gate.proposedChange.details ?? gate.proposedChange.summary ?? null;

  return (
    <div className="min-w-0 rounded-md border border-border/70 bg-card/75 p-3 shadow-[0_8px_24px_-20px_--alpha(var(--color-black)/18%)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <FileDiffIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="truncate text-sm font-medium text-foreground">{gate.description}</p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {gate.type} · {new Date(gate.createdAt).toLocaleTimeString()}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
            status.className,
          )}
        >
          <status.Icon className="size-3" aria-hidden="true" />
          {status.label}
        </span>
      </div>

      {files.length > 0 ? (
        <div className="mt-3 space-y-2">
          {files.map((file) => (
            <div key={file.path} className="min-w-0 rounded-md border border-border/55 bg-muted/20">
              <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border/45 px-2 py-1.5">
                <span className="truncate text-xs font-medium text-foreground/85">{file.path}</span>
                {file.status ? (
                  <span className="shrink-0 text-[10px] text-muted-foreground">{file.status}</span>
                ) : null}
              </div>
              {file.diff ? (
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap px-2 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {file.diff}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : details ? (
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border/55 bg-muted/20 px-2 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {details}
        </pre>
      ) : null}

      {gate.status === "pending" ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="destructive-outline"
            disabled={isBusy}
            onClick={() => {
              if (window.confirm("Reject this proposed change?")) {
                onReject(gate);
              }
            }}
          >
            Reject
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              if (window.confirm("Approve and execute this proposed change?")) {
                onApprove(gate);
              }
            }}
          >
            Approve
          </Button>
        </div>
      ) : null}
    </div>
  );
});

function statusCopy(status: ThreadApprovalGate["status"]) {
  switch (status) {
    case "approved":
      return {
        label: "approved",
        Icon: CheckCircle2Icon,
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
      };
    case "rejected":
      return {
        label: "rejected",
        Icon: XCircleIcon,
        className: "border-destructive/30 bg-destructive/10 text-destructive",
      };
    case "pending":
      return {
        label: "pending",
        Icon: Clock3Icon,
        className: "border-amber-500/30 bg-amber-500/10 text-amber-600",
      };
  }
}

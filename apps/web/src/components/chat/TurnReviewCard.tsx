import { memo, useCallback, useState } from "react";
import { CheckIcon, XIcon, FileIcon } from "lucide-react";
import type { TurnDiffFileChange } from "~/types";
import type { TurnId, RuntimeMode } from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import { summarizeTurnDiffInPlainLanguage } from "~/lib/turnDiffTree";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export const TurnReviewCard = memo(function TurnReviewCard(props: {
  threadId: string;
  turnId: TurnId;
  turnCount: number;
  files: ReadonlyArray<TurnDiffFileChange>;
  disabled: boolean;
  onReviewed: () => void;
}) {
  // All hooks must be called before any conditional returns
  const thread = useStore((store) => store.threads.find((t) => t.id === props.threadId));
  const [isProcessing, setIsProcessing] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);

  // Don't show review card in Full Access mode — user opted out of approval gating
  if (thread?.runtimeMode === "full-access") {
    return null;
  }

  const summary = summarizeTurnDiffInPlainLanguage(props.files);

  const handleApprove = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    setIsProcessing(true);
    try {
      await api.review.approve({
        threadId: props.threadId,
        turnId: props.turnId,
      });
      setDecision("approved");
      props.onReviewed();
    } catch {
      // Handle silently
    } finally {
      setIsProcessing(false);
    }
  }, [props]);

  const handleReject = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    setIsProcessing(true);
    try {
      await api.review.reject({
        threadId: props.threadId,
        turnId: props.turnId,
        turnCount: props.turnCount,
      });
      setDecision("rejected");
      props.onReviewed();
    } catch {
      // Handle silently
    } finally {
      setIsProcessing(false);
    }
  }, [props]);

  if (decision === "approved") {
    return (
      <div className="mx-4 my-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckIcon className="inline size-3 mr-1" />
        Changes approved
      </div>
    );
  }

  if (decision === "rejected") {
    return (
      <div className="mx-4 my-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
        <XIcon className="inline size-3 mr-1" />
        Changes rejected — reverting to previous state
      </div>
    );
  }

  return (
    <div className="mx-4 my-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <FileIcon className="size-3.5 text-amber-500" />
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
          Review changes
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          ({props.files.length} file{props.files.length !== 1 ? "s" : ""})
        </span>
      </div>

      <p className="text-xs text-foreground/70 mb-3">{summary}</p>

      <div className="flex items-center gap-2">
        <Button
          size="xs"
          variant="outline"
          className={cn(
            "h-7 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400",
          )}
          disabled={isProcessing || props.disabled}
          onClick={() => void handleApprove()}
        >
          <CheckIcon className="size-3 mr-1" />
          Approve
        </Button>
        <Button
          size="xs"
          variant="outline"
          className="h-7 border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400"
          disabled={isProcessing || props.disabled}
          onClick={() => void handleReject()}
        >
          <XIcon className="size-3 mr-1" />
          Reject & Revert
        </Button>
      </div>
    </div>
  );
});

import { memo, useId } from "react";

import type { ThreadExportFormat } from "../../threadExport";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { cn } from "~/lib/utils";

export const ThreadExportDialog = memo(function ThreadExportDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadTitle: string;
  workspaceRoot: string | undefined;
  format: ThreadExportFormat;
  onFormatChange: (format: ThreadExportFormat) => void;
  savePath: string;
  onSavePathChange: (value: string) => void;
  defaultFilename: string;
  onDownload: () => void;
  onSaveToWorkspace: () => void;
  isSavingToWorkspace: boolean;
}) {
  const savePathInputId = useId();

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Export thread</DialogTitle>
          <DialogDescription>
            Download or save a {props.format === "json" ? "JSON" : "Markdown"} export for{" "}
            <span className="font-medium text-foreground">{props.threadTitle}</span>.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground" id="export-format-label">
              Format
            </p>
            <div
              className="flex items-center gap-2"
              role="radiogroup"
              aria-labelledby="export-format-label"
            >
              <button
                type="button"
                role="radio"
                aria-checked={props.format === "markdown"}
                disabled={props.isSavingToWorkspace}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
                  props.format === "markdown"
                    ? "border-border bg-accent text-accent-foreground"
                    : "border-border/70 text-muted-foreground hover:text-foreground",
                )}
                onClick={() => props.onFormatChange("markdown")}
              >
                Markdown
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={props.format === "json"}
                disabled={props.isSavingToWorkspace}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
                  props.format === "json"
                    ? "border-border bg-accent text-accent-foreground"
                    : "border-border/70 text-muted-foreground hover:text-foreground",
                )}
                onClick={() => props.onFormatChange("json")}
              >
                JSON
              </button>
            </div>
          </div>
          <label htmlFor={savePathInputId} className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Workspace path</span>
            <Input
              id={savePathInputId}
              value={props.savePath}
              onChange={(event) => props.onSavePathChange(event.target.value)}
              placeholder={props.defaultFilename}
              spellCheck={false}
              disabled={!props.workspaceRoot || props.isSavingToWorkspace}
            />
            <span className="text-xs text-muted-foreground/75">
              {props.workspaceRoot
                ? `Relative to ${props.workspaceRoot}`
                : "Workspace path is unavailable for this thread."}
            </span>
          </label>
        </DialogPanel>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={props.onDownload}
            disabled={props.isSavingToWorkspace}
          >
            Download {props.format === "json" ? "JSON" : "Markdown"}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => props.onOpenChange(false)}
              disabled={props.isSavingToWorkspace}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={props.onSaveToWorkspace}
              disabled={!props.workspaceRoot || props.isSavingToWorkspace}
            >
              {props.isSavingToWorkspace ? "Saving..." : "Save to workspace"}
            </Button>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
});

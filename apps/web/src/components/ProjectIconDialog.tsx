import { useCallback, useEffect, useRef, useState } from "react";
import { FolderIcon, ImageIcon, TrashIcon } from "lucide-react";

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";
import { resolveServerHttpUrl } from "~/lib/serverUrl";

const ICON_PATH = ".rowl/icon.png";
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/x-icon"];
const MAX_SIZE_BYTES = 256 * 1024;

interface ProjectIconDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectCwd: string;
  onSave: (iconDataUrl: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

export function ProjectIconDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectCwd,
  onSave,
  onRemove,
}: ProjectIconDialogProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentIconSrc = resolveServerHttpUrl(`/api/project-favicon?cwd=${encodeURIComponent(projectCwd)}&t=${Date.now()}`);

  const reset = useCallback(() => {
    setPreview(null);
    setSelectedFile(null);
    setError(null);
    setIsSaving(false);
    setIsRemoving(false);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please select a PNG, JPEG, SVG, or ICO file.");
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setError("File must be smaller than 256 KB.");
      return;
    }

    setError(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSave = useCallback(async () => {
    if (!preview) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(preview);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save icon.");
    } finally {
      setIsSaving(false);
    }
  }, [preview, onSave, onOpenChange]);

  const handleRemove = useCallback(async () => {
    setIsRemoving(true);
    setError(null);
    try {
      await onRemove();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove icon.");
    } finally {
      setIsRemoving(false);
    }
  }, [onRemove, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogPanel className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Project Icon</DialogTitle>
            <DialogDescription>
              Choose an icon for <strong>{projectName}</strong>. The icon is saved as{" "}
              <code className="text-xs">{ICON_PATH}</code> in your project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current icon preview */}
            <div className="flex items-center justify-center">
              <div className="relative">
                {preview ? (
                  <img
                    src={preview}
                    alt="Icon preview"
                    className="size-16 rounded-lg object-contain border bg-background"
                  />
                ) : (
                  <div className="flex items-center justify-center size-16 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
                    <ImageIcon className="size-8 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            </div>

            {/* Current icon info */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
              <span>Current: </span>
              <img
                src={currentIconSrc}
                alt=""
                className="size-4 rounded-sm object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="font-mono">{ICON_PATH}</span>
            </div>

            {/* File input */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving || isRemoving}
              >
                <ImageIcon className="size-4" />
                {selectedFile ? "Change icon" : "Select icon"}
              </Button>
              {selectedFile && (
                <p className="text-xs text-muted-foreground/60 text-center">
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || isRemoving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRemove}
              disabled={isSaving || isRemoving || !preview}
              className="text-destructive hover:text-destructive"
            >
              <TrashIcon className="size-4" />
              {isRemoving ? "Removing..." : "Remove"}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!selectedFile || isSaving || isRemoving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}

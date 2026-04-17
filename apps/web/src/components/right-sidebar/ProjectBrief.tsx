import { useState, useCallback, useEffect } from "react";
import { FileTextIcon, CheckIcon, PencilIcon } from "lucide-react";

import { readNativeApi } from "~/nativeApi";
import { Button } from "~/components/ui/button";

const BRIEF_PATH = ".rowl/project-brief.md";

export function ProjectBrief({ projectCwd }: { projectCwd: string }) {
  const [brief, setBrief] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchBrief = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    try {
      const result = await api.projects.readFile({
        cwd: projectCwd,
        relativePath: BRIEF_PATH,
      });
      setBrief(result.exists ? (result.contents ?? "") : null);
    } catch {
      setBrief(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectCwd]);

  useEffect(() => {
    void fetchBrief();
  }, [fetchBrief]);

  const saveBrief = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    try {
      await api.projects.writeFile({
        cwd: projectCwd,
        relativePath: BRIEF_PATH,
        contents: editText,
      });
      setBrief(editText);
      setIsEditing(false);
    } catch {
      // Handle error silently
    }
  }, [editText, projectCwd]);

  const startEditing = useCallback(() => {
    setEditText(brief ?? "");
    setIsEditing(true);
  }, [brief]);

  if (isLoading) return null;

  if (isEditing) {
    return (
      <div className="border-b border-border/40 px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <FileTextIcon className="size-3.5 text-muted-foreground/60" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
              Project Brief
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant="outline"
              className="h-5 text-[10px]"
              onClick={() => void saveBrief()}
            >
              <CheckIcon className="size-3 mr-0.5" />
              Save
            </Button>
            <Button
              size="xs"
              variant="ghost"
              className="h-5 text-[10px]"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          placeholder="Describe your product: what it is, who it's for, and what it does..."
          className="w-full min-h-[80px] rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className="border-b border-border/40 px-3 py-2.5 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileTextIcon className="size-3.5 text-muted-foreground/60" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
            Project Brief
          </span>
        </div>
        <button
          type="button"
          onClick={startEditing}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-foreground/70 transition-all"
          title="Edit project brief"
        >
          <PencilIcon className="size-3" />
        </button>
      </div>
      {brief ? (
        <p
          className="mt-1 text-xs text-foreground/70 line-clamp-3 cursor-pointer hover:text-foreground/90"
          onClick={startEditing}
        >
          {brief.split("\n")[0] || brief.slice(0, 100)}
        </p>
      ) : (
        <p
          className="mt-1 text-xs text-muted-foreground/40 italic cursor-pointer hover:text-muted-foreground/60"
          onClick={startEditing}
        >
          Add a brief describing your product...
        </p>
      )}
    </div>
  );
}

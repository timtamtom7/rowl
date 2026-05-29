/**
 * ProjectPromptsSection — UI for managing project rules and selecting harnesses.
 *
 * Two parts:
 * 1. Rules — persistent instructions the user writes for this project
 * 2. Harnesses — pre-built workflow templates the user can activate
 */
import { useState, useCallback, useEffect } from "react";
import {
  FileTextIcon,
  PlusIcon,
  Trash2Icon,
  ToggleLeftIcon,
  ToggleRightIcon,
  ShieldIcon,
  CheckIcon,
  ZapIcon,
} from "lucide-react";
import type { ProjectId } from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface ProjectPrompt {
  id: string;
  name: string;
  content: string;
  scope: string;
  enabled: boolean;
}

interface HarnessPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  isBuiltin: boolean;
}

export function ProjectPromptsSection({ projectId }: { projectId: ProjectId }) {
  const [prompts, setPrompts] = useState<ProjectPrompt[]>([]);
  const [presets, setPresets] = useState<HarnessPreset[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingHarness, setIsCreatingHarness] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newHarnessName, setNewHarnessName] = useState("");
  const [newHarnessDesc, setNewHarnessDesc] = useState("");
  const [newHarnessContent, setNewHarnessContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    try {
      const [promptsResult, presetsResult] = await Promise.all([
        api.prompts.list({ projectId }),
        api.harness.listPresets(),
      ]);
      setPrompts((promptsResult.prompts ?? []) as unknown as ProjectPrompt[]);
      setPresets((presetsResult.presets ?? []) as unknown as HarnessPreset[]);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const createPrompt = useCallback(async () => {
    const name = newName.trim();
    const content = newContent.trim();
    if (!name || !content) return;
    const api = readNativeApi();
    if (!api) return;
    try {
      await api.prompts.create({
        projectId,
        threadId: null,
        scope: "project",
        name,
        content,
      });
      setNewName("");
      setNewContent("");
      setIsCreating(false);
      void fetchData();
    } catch {
      // Handle silently
    }
  }, [newName, newContent, projectId, fetchData]);

  const togglePrompt = useCallback(
    async (prompt: ProjectPrompt) => {
      const api = readNativeApi();
      if (!api) return;
      try {
        await api.prompts.update({ id: prompt.id, enabled: !prompt.enabled });
        void fetchData();
      } catch {
        // Handle silently
      }
    },
    [fetchData],
  );

  const deletePrompt = useCallback(
    async (id: string) => {
      const api = readNativeApi();
      if (!api) return;
      try {
        await api.prompts.delete({ id });
        void fetchData();
      } catch {
        // Handle silently
      }
    },
    [fetchData],
  );

  if (isLoading) return null;

  return (
    <div className="border-b border-border/40">
      {/* Rules section */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <FileTextIcon className="size-3.5 text-muted-foreground/60" />
          <span className="text-xs font-medium text-foreground/80">Rules ({prompts.length})</span>
        </div>
        <Button
          size="xs"
          variant="ghost"
          className="h-5"
          onClick={() => setIsCreating(!isCreating)}
        >
          <PlusIcon className="size-3" />
        </Button>
      </div>

      {/* Create rule form */}
      {isCreating && (
        <div className="px-3 pb-2 space-y-1.5">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Rule name (e.g. 'Always use TypeScript')"
            className="text-xs h-7"
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Instructions for the AI..."
            className="w-full min-h-[50px] rounded-md border border-border bg-background px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex justify-end gap-1">
            <Button
              size="xs"
              variant="ghost"
              className="h-5 text-[10px]"
              onClick={() => setIsCreating(false)}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              variant="outline"
              className="h-5 text-[10px]"
              onClick={() => void createPrompt()}
              disabled={!newName.trim() || !newContent.trim()}
            >
              Save Rule
            </Button>
          </div>
        </div>
      )}

      {/* Existing rules */}
      {prompts.map((prompt) => (
        <div
          key={prompt.id}
          className="flex items-center gap-2 px-3 py-1.5 group hover:bg-accent/10"
        >
          <button
            type="button"
            onClick={() => void togglePrompt(prompt)}
            className={cn(
              "shrink-0 transition-colors",
              prompt.enabled ? "text-primary" : "text-muted-foreground/30",
            )}
            title={prompt.enabled ? "Disable rule" : "Enable rule"}
          >
            {prompt.enabled ? (
              <ToggleRightIcon className="size-4" />
            ) : (
              <ToggleLeftIcon className="size-4" />
            )}
          </button>
          <span
            className={cn(
              "text-xs flex-1 truncate",
              prompt.enabled ? "text-foreground/80" : "text-muted-foreground/40",
            )}
          >
            {prompt.name}
          </span>
          <button
            type="button"
            onClick={() => void deletePrompt(prompt.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
          >
            <Trash2Icon className="size-3" />
          </button>
        </div>
      ))}

      {/* Harness presets */}
      {presets.length > 0 && (
        <>
          <div className="flex items-center justify-between px-3 py-2 mt-1">
            <div className="flex items-center gap-1.5">
              <ShieldIcon className="size-3.5 text-muted-foreground/60" />
              <span className="text-xs font-medium text-foreground/80">Harnesses</span>
            </div>
          </div>
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-start gap-2 px-3 py-1.5 hover:bg-accent/10 cursor-pointer"
              title={`Click to view: ${preset.description}`}
            >
              <ZapIcon className="size-3 mt-0.5 text-amber-500/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground/80">{preset.name}</p>
                <p className="text-[9px] text-muted-foreground/40">{preset.description}</p>
              </div>
              {preset.isBuiltin && (
                <span className="text-[8px] text-muted-foreground/30 shrink-0">built-in</span>
              )}
            </div>
          ))}

          {/* Create custom harness */}
          {isCreatingHarness ? (
            <div className="px-3 py-2 space-y-1.5 bg-accent/5">
              <Input
                value={newHarnessName}
                onChange={(e) => setNewHarnessName(e.target.value)}
                placeholder="Harness name"
                className="text-xs h-7"
                autoFocus
              />
              <Input
                value={newHarnessDesc}
                onChange={(e) => setNewHarnessDesc(e.target.value)}
                placeholder="Short description"
                className="text-xs h-7"
              />
              <textarea
                value={newHarnessContent}
                onChange={(e) => setNewHarnessContent(e.target.value)}
                placeholder={`Workflow instructions for the AI...\n\nExample:\nPHASE 1: Research the codebase\nPHASE 2: Write a plan\nPHASE 3: Implement step by step\nPHASE 4: Run tests and verify`}
                className="w-full min-h-[100px] rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-mono resize-y focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex justify-end gap-1">
                <Button
                  size="xs"
                  variant="ghost"
                  className="h-5 text-[10px]"
                  onClick={() => setIsCreatingHarness(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  className="h-5 text-[10px]"
                  disabled={!newHarnessName.trim() || !newHarnessContent.trim()}
                  onClick={async () => {
                    // Create as a project-scoped rule with harness-style content
                    const api = readNativeApi();
                    if (!api) return;
                    await api.prompts.create({
                      projectId,
                      threadId: null,
                      scope: "project",
                      name: `Harness: ${newHarnessName.trim()}`,
                      content: `<harness name="${newHarnessName.trim().toLowerCase().replace(/\s+/g, "-")}">\n${newHarnessContent.trim()}\n</harness>`,
                    });
                    setNewHarnessName("");
                    setNewHarnessDesc("");
                    setNewHarnessContent("");
                    setIsCreatingHarness(false);
                    void fetchData();
                  }}
                >
                  Save Harness
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreatingHarness(true)}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/10 transition-colors"
            >
              <PlusIcon className="size-3" />
              Create custom harness
            </button>
          )}
        </>
      )}
    </div>
  );
}

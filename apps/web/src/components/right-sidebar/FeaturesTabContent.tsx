import { useState, useCallback, useRef, useEffect } from "react";
import { PlusIcon, Trash2Icon, GripVerticalIcon, LinkIcon, LayoutGridIcon } from "lucide-react";
import type { ProjectId, FeatureStage } from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useSidebarFeatures } from "~/lib/sidebarReactQuery";
import { useRightSidebar } from "./RightSidebarContext";

const STAGES: { key: FeatureStage; label: string; color: string; dotColor: string }[] = [
  { key: "backlog", label: "Backlog", color: "border-slate-400/50", dotColor: "bg-slate-400" },
  { key: "in_progress", label: "In Progress", color: "border-sky-500/50", dotColor: "bg-sky-500" },
  { key: "done", label: "Done", color: "border-emerald-500/50", dotColor: "bg-emerald-500" },
  { key: "wishlist", label: "Wishlist", color: "border-violet-500/50", dotColor: "bg-violet-500" },
];

export function FeaturesTabContent({ projectId }: { projectId: ProjectId }) {
  const { features, isLoading, createFeature, moveFeature, deleteFeature } =
    useSidebarFeatures(projectId);
  const { navigateToTab } = useRightSidebar();
  const threads = useStore((store) => store.threads);
  const [featureLinks, setFeatureLinks] = useState<
    Map<string, Array<{ threadId: string; threadTitle: string }>>
  >(new Map());

  // Fetch feature-thread links
  useEffect(() => {
    const api = readNativeApi();
    if (!api) return;
    api.featureThreadLinks
      .getLinks({ projectId })
      .then((result) => {
        const linkMap = new Map<string, Array<{ threadId: string; threadTitle: string }>>();
        for (const link of result.links) {
          const thread = threads.find((t) => t.id === link.threadId);
          const entry = { threadId: link.threadId, threadTitle: thread?.title ?? "Thread" };
          const existing = linkMap.get(link.featureId) ?? [];
          existing.push(entry);
          linkMap.set(link.featureId, existing);
        }
        setFeatureLinks(linkMap);
      })
      .catch(() => {});
  }, [projectId, threads, features]);
  const [newFeatureName, setNewFeatureName] = useState("");
  const [addingToStage, setAddingToStage] = useState<FeatureStage | null>(null);
  const [dragOverStage, setDragOverStage] = useState<FeatureStage | null>(null);
  const draggedFeatureRef = useRef<string | null>(null);

  const handleCreate = useCallback(
    (stage: FeatureStage) => {
      const name = newFeatureName.trim();
      if (!name) return;
      createFeature.mutate({ name, stage });
      setNewFeatureName("");
      setAddingToStage(null);
    },
    [newFeatureName, createFeature],
  );

  // ── Drag-drop handlers ──────────────────────────────────────
  const handleDragStart = useCallback((featureId: string) => {
    draggedFeatureRef.current = featureId;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: FeatureStage) => {
    e.preventDefault();
    setDragOverStage(stage);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback(
    (targetStage: FeatureStage) => {
      const featureId = draggedFeatureRef.current;
      if (!featureId) return;
      draggedFeatureRef.current = null;
      setDragOverStage(null);
      moveFeature.mutate({ id: featureId, stage: targetStage });
    },
    [moveFeature],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading features...
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <LayoutGridIcon className="size-6 text-muted-foreground/20 mb-2" />
        <p className="text-sm text-muted-foreground">No features yet.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Ask the PM to break your project into features, or add one manually below.
        </p>
        <button
          type="button"
          onClick={() => setAddingToStage("backlog")}
          className="mt-3 text-xs text-primary/60 hover:text-primary transition-colors"
        >
          + Add your first feature
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {STAGES.map((stage) => {
        const stageFeatures = features.filter((f) => f.stage === stage.key);
        const isDragTarget = dragOverStage === stage.key;

        return (
          <div
            key={stage.key}
            className={cn(
              "border-b border-border/40 transition-colors",
              isDragTarget && "bg-primary/5",
            )}
            onDragOver={(e) => handleDragOver(e, stage.key)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(stage.key)}
          >
            {/* Stage header */}
            <div className="flex items-center justify-between px-3 py-2 bg-card/60">
              <div className="flex items-center gap-2">
                <div className={cn("w-1.5 h-4 rounded-full border-2", stage.color)} />
                <span className="text-xs font-medium text-foreground/80">{stage.label}</span>
                <span className="text-[10px] text-muted-foreground/50">{stageFeatures.length}</span>
              </div>
              <Button
                size="xs"
                variant="ghost"
                className="size-5 p-0"
                onClick={() => setAddingToStage(addingToStage === stage.key ? null : stage.key)}
                title={`Add to ${stage.label}`}
              >
                <PlusIcon className="size-3" />
              </Button>
            </div>

            {/* Add feature input */}
            {addingToStage === stage.key && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10">
                <Input
                  value={newFeatureName}
                  onChange={(e) => setNewFeatureName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate(stage.key);
                    if (e.key === "Escape") setAddingToStage(null);
                  }}
                  placeholder="Feature name..."
                  className="text-xs h-6 flex-1"
                  autoFocus
                />
                <Button
                  size="xs"
                  variant="outline"
                  className="h-6"
                  onClick={() => handleCreate(stage.key)}
                  disabled={!newFeatureName.trim()}
                >
                  Add
                </Button>
              </div>
            )}

            {/* Feature cards */}
            {stageFeatures.map((feature) => (
              <div
                key={feature.id}
                draggable
                onDragStart={() => handleDragStart(feature.id)}
                className="flex items-start gap-2 px-3 py-2 group hover:bg-accent/15 border-t border-border/20 cursor-grab active:cursor-grabbing"
              >
                <GripVerticalIcon className="size-3 mt-1 text-muted-foreground/20 group-hover:text-muted-foreground/50 shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80 truncate">{feature.name}</p>
                  {feature.description && (
                    <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">
                      {feature.description}
                    </p>
                  )}
                  {/* Linked threads */}
                  {featureLinks.get(feature.id)?.map((link) => (
                    <button
                      key={link.threadId}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToTab("threads", { type: "thread", id: link.threadId });
                      }}
                      className="inline-flex items-center gap-0.5 mt-0.5 mr-1 rounded bg-sky-500/10 px-1 py-0.5 text-[9px] text-sky-400 hover:bg-sky-500/20 transition-colors"
                    >
                      <LinkIcon className="size-2" />
                      {link.threadTitle.slice(0, 18)}
                    </button>
                  ))}
                </div>

                {/* Stage move dots — show ALL other stages */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {STAGES.filter((s) => s.key !== stage.key).map((targetStage) => (
                    <button
                      key={targetStage.key}
                      type="button"
                      onClick={() => moveFeature.mutate({ id: feature.id, stage: targetStage.key })}
                      className="p-0.5 hover:scale-150 transition-transform"
                      title={`Move to ${targetStage.label}`}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full", targetStage.dotColor)} />
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => deleteFeature.mutate(feature.id)}
                  className="mt-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
                  title="Delete feature"
                >
                  <Trash2Icon className="size-3" />
                </button>
              </div>
            ))}

            {stageFeatures.length === 0 && addingToStage !== stage.key && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground/30 italic">
                {isDragTarget ? "Drop here" : "No features"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

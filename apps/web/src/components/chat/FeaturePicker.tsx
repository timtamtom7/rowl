import { memo, useState, useCallback, useEffect, useMemo } from "react";
import { LayoutGridIcon, ChevronDownIcon, XIcon } from "lucide-react";
import type { ProjectId, Feature } from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";
import { cn } from "~/lib/utils";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";

export const FeaturePicker = memo(function FeaturePicker(props: {
  projectId: ProjectId;
  activeFeatureId: string | null;
  disabled: boolean;
  compact: boolean;
  onSelectFeature: (featureId: string | null, featureName: string | null) => void;
}) {
  const [features, setFeatures] = useState<Feature[]>([]);

  useEffect(() => {
    const api = readNativeApi();
    if (!api) return;
    void api.features
      .listByProject({ projectId: props.projectId })
      .then((result) => {
        setFeatures(result.features as Feature[]);
      })
      .catch(() => {});
  }, [props.projectId]);

  const actionableFeatures = useMemo(
    () => features.filter((f) => f.stage === "backlog" || f.stage === "in_progress"),
    [features],
  );

  const activeFeature = useMemo(
    () => features.find((f) => f.id === props.activeFeatureId) ?? null,
    [features, props.activeFeatureId],
  );

  if (actionableFeatures.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        disabled={props.disabled}
        className={cn(
          "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs transition-colors",
          activeFeature
            ? "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
            : "border-border/60 bg-muted/20 text-muted-foreground/60 hover:bg-muted/30 hover:text-muted-foreground/80",
        )}
      >
        <LayoutGridIcon className="size-3" />
        <span className={props.compact ? "sr-only" : "sr-only sm:not-sr-only"}>
          {activeFeature ? activeFeature.name : "Feature"}
        </span>
        <ChevronDownIcon className="size-3" />
      </PopoverTrigger>
      <PopoverPopup align="start" side="top" className="w-64 p-0">
        <div className="border-b border-border/60 px-3 py-2">
          <div className="text-xs font-medium text-foreground">Working on</div>
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">
            Select which feature this conversation is building
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto py-1">
          {activeFeature && (
            <button
              type="button"
              onClick={() => props.onSelectFeature(null, null)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/30"
            >
              <XIcon className="size-3" />
              Clear selection
            </button>
          )}
          {actionableFeatures.map((feature) => (
            <button
              key={feature.id}
              type="button"
              onClick={() => props.onSelectFeature(feature.id, feature.name)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                feature.id === props.activeFeatureId
                  ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  : "text-foreground/80 hover:bg-muted/30",
              )}
            >
              <div
                className={cn(
                  "size-1.5 rounded-full shrink-0",
                  feature.stage === "in_progress" ? "bg-sky-500" : "bg-muted-foreground/30",
                )}
              />
              <span className="truncate flex-1">{feature.name}</span>
              <span className="text-[9px] text-muted-foreground/40 shrink-0">
                {feature.stage === "in_progress" ? "Active" : "Backlog"}
              </span>
            </button>
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  );
});

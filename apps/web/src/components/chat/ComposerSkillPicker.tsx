import { memo, useState, useCallback } from "react";

import type { ProjectSkill, ProjectSkillName } from "@t3tools/contracts";
import { CheckIcon, PlusIcon, SparklesIcon } from "lucide-react";

import { readNativeApi } from "~/nativeApi";
import { Badge } from "../ui/badge";
import { Button, buttonVariants } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { cn } from "~/lib/utils";

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function toSkillName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export const ComposerSkillPicker = memo(function ComposerSkillPicker(props: {
  skills: ReadonlyArray<ProjectSkill>;
  selectedSkillNames: ReadonlyArray<ProjectSkillName>;
  issuesCount: number;
  disabled: boolean;
  compact: boolean;
  projectCwd?: string | undefined;
  onToggleSkill: (skillName: ProjectSkillName) => void;
  onSkillCreated?: () => void;
}) {
  const selectedCount = props.selectedSkillNames.length;

  return (
    <Popover>
      <PopoverTrigger
        disabled={props.disabled}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-muted-foreground/70 transition-[background-color,color,transform,box-shadow] hover:bg-muted/35 hover:text-foreground/85 motion-safe:hover:-translate-y-px sm:px-3.5",
          selectedCount > 0 &&
            "bg-amber-500/10 text-amber-500 hover:bg-amber-500/14 hover:text-amber-400",
        )}
      >
        <SparklesIcon className="size-3.5" />
        <span className={props.compact ? "sr-only" : "sr-only sm:not-sr-only"}>
          Skills{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </span>
      </PopoverTrigger>
      <PopoverPopup align="start" side="top" className="w-80 p-0">
        <div className="border-b border-border/60 px-4 py-3">
          <div className="font-medium text-sm text-foreground">Repository skills</div>
          <div className="mt-1 text-muted-foreground text-xs leading-relaxed">
            Attach reusable repo-local instructions to the next turn.
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto px-2 py-2">
          {props.skills.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 py-3 text-sm text-muted-foreground">
              No skills found in .rowl/skills.
            </div>
          ) : (
            <div className="space-y-1">
              {props.skills.map((skill) => {
                const isSelected = props.selectedSkillNames.includes(skill.name);
                return (
                  <button
                    key={skill.name}
                    type="button"
                    onClick={() => props.onToggleSkill(skill.name)}
                    className={cn(
                      "app-interactive-motion flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left",
                      isSelected
                        ? "border-amber-500/35 bg-amber-500/8 text-foreground"
                        : "border-transparent bg-muted/20 text-foreground/80 hover:border-border/40 hover:bg-muted/35",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md",
                        isSelected
                          ? "bg-amber-500/18 text-amber-500"
                          : "bg-muted/50 text-muted-foreground/60",
                      )}
                    >
                      {isSelected ? (
                        <CheckIcon className="size-3.5" />
                      ) : (
                        <SparklesIcon className="size-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-sm text-foreground">
                          {skill.name}
                        </span>
                        {isSelected ? <Badge variant="secondary">Selected</Badge> : null}
                      </span>
                      <span className="mt-1 line-clamp-3 block text-muted-foreground text-xs leading-relaxed">
                        {skill.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {props.projectCwd && (
          <SkillCreatorSection projectCwd={props.projectCwd} onCreated={props.onSkillCreated} />
        )}
        {props.issuesCount > 0 ? (
          <div className="border-t border-border/60 px-4 py-2 text-muted-foreground text-xs">
            {props.issuesCount} invalid skill file{props.issuesCount === 1 ? "" : "s"} ignored.
          </div>
        ) : null}
      </PopoverPopup>
    </Popover>
  );
});

function SkillCreatorSection({
  projectCwd: _projectCwd,
  onCreated: _onCreated,
}: {
  projectCwd: string;
  onCreated?: (() => void) | undefined;
}) {
  return (
    <div className="border-t border-border/60">
      <div className="px-4 py-2.5 text-xs text-muted-foreground">
        <SparklesIcon className="size-3 inline mr-1" />
        Use the Context tab in the right sidebar to generate skills with AI.
      </div>
    </div>
  );
}

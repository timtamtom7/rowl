import { useState, useCallback } from "react";
import { RocketIcon, TargetIcon, LayoutGridIcon, CheckIcon, ArrowRightIcon } from "lucide-react";
import type { ProjectId } from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type WizardStep = "brief" | "goal" | "features" | "done";

const STEPS: { key: WizardStep; label: string; subtitle: string; icon: React.ReactNode }[] = [
  {
    key: "brief",
    label: "What are you building?",
    subtitle:
      "Describe your product so the AI understands what you're building. This is like briefing a new team member.",
    icon: <RocketIcon className="size-5" />,
  },
  {
    key: "goal",
    label: "What's your main goal?",
    subtitle: "What's the one thing you want to accomplish first? The AI will focus on this.",
    icon: <TargetIcon className="size-5" />,
  },
  {
    key: "features",
    label: "What features do you need?",
    subtitle: "List the key parts of your product. You can always add more later.",
    icon: <LayoutGridIcon className="size-5" />,
  },
];

export function ProjectSetupWizard({
  projectId,
  projectCwd,
  onComplete,
}: {
  projectId: ProjectId;
  projectCwd: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<WizardStep>("brief");
  const [briefText, setBriefText] = useState("");
  const [goalText, setGoalText] = useState("");
  const [featureInputs, setFeatureInputs] = useState(["", "", ""]);
  const [isSaving, setIsSaving] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const saveBrief = useCallback(async () => {
    const api = readNativeApi();
    if (!api || !briefText.trim()) return;
    try {
      await api.projects.writeFile({
        cwd: projectCwd,
        relativePath: ".rowl/project-brief.md",
        contents: briefText.trim(),
      });
    } catch {
      // Continue even if save fails
    }
    setStep("goal");
  }, [briefText, projectCwd]);

  const saveGoal = useCallback(async () => {
    const api = readNativeApi();
    if (!api || !goalText.trim()) return;
    try {
      await api.goals.create({ projectId, text: goalText.trim(), isMain: true });
    } catch {
      // Continue even if save fails
    }
    setStep("features");
  }, [goalText, projectId]);

  const saveFeatures = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    setIsSaving(true);
    try {
      for (const name of featureInputs) {
        if (name.trim()) {
          await api.features.create({
            projectId,
            name: name.trim(),
            description: "",
            stage: "backlog",
            createdBy: "user",
          });
        }
      }
    } catch {
      // Continue even if save fails
    }
    setIsSaving(false);
    setStep("done");
    onComplete();
  }, [featureInputs, projectId, onComplete]);

  const skipStep = useCallback(() => {
    if (step === "brief") setStep("goal");
    else if (step === "goal") setStep("features");
    else if (step === "features") {
      setStep("done");
      onComplete();
    }
  }, [step, onComplete]);

  if (step === "done") return null;

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      {/* Welcome message */}
      {currentStepIndex === 0 && (
        <div className="text-center mb-6">
          <p className="text-lg font-semibold text-foreground">Let's set up your project</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Tell your AI Product Manager about your project. It'll use this to stay focused and help
            you build.
          </p>
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={cn(
              "flex items-center gap-1.5",
              i < currentStepIndex
                ? "text-emerald-500"
                : i === currentStepIndex
                  ? "text-foreground"
                  : "text-muted-foreground/30",
            )}
          >
            {i < currentStepIndex ? (
              <CheckIcon className="size-4" />
            ) : (
              <div
                className={cn(
                  "size-6 rounded-full flex items-center justify-center text-xs font-medium border",
                  i === currentStepIndex
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40",
                )}
              >
                {i + 1}
              </div>
            )}
            {i < STEPS.length - 1 && (
              <div
                className={cn("w-8 h-px", i < currentStepIndex ? "bg-emerald-500" : "bg-border/40")}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {STEPS[currentStepIndex]?.icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {STEPS[currentStepIndex]?.label}
            </h2>
            <p className="text-xs text-muted-foreground">{STEPS[currentStepIndex]?.subtitle}</p>
          </div>
        </div>

        {step === "brief" && (
          <div className="space-y-3">
            <textarea
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              placeholder="Example: A restaurant ordering app where customers can browse the menu, add items to cart, and place orders for pickup or delivery..."
              className="w-full min-h-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
        )}

        {step === "goal" && (
          <div className="space-y-3">
            <Input
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              placeholder="Example: Build a fully functional restaurant ordering app"
              className="text-sm"
              autoFocus
            />
          </div>
        )}

        {step === "features" && (
          <div className="space-y-2">
            {featureInputs.map((value, index) => (
              <Input
                key={index}
                value={value}
                onChange={(e) => {
                  const next = [...featureInputs];
                  next[index] = e.target.value;
                  setFeatureInputs(next);
                }}
                placeholder={
                  index === 0
                    ? "Example: Menu page"
                    : index === 1
                      ? "Example: Shopping cart"
                      : "Example: Checkout flow"
                }
                className="text-sm"
                autoFocus={index === 0}
              />
            ))}
            <button
              type="button"
              onClick={() => setFeatureInputs([...featureInputs, ""])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Add another feature
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-5">
          <button
            type="button"
            onClick={skipStep}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Skip this step
          </button>
          <Button
            onClick={() => {
              if (step === "brief") void saveBrief();
              else if (step === "goal") void saveGoal();
              else if (step === "features") void saveFeatures();
            }}
            disabled={
              isSaving ||
              (step === "brief" && !briefText.trim()) ||
              (step === "goal" && !goalText.trim()) ||
              (step === "features" && !featureInputs.some((f) => f.trim()))
            }
          >
            {step === "features" ? (
              isSaving ? (
                "Saving..."
              ) : (
                "Start building"
              )
            ) : (
              <>
                Next
                <ArrowRightIcon className="size-3.5 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

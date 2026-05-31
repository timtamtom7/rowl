import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  SendIcon,
  SparklesIcon,
  CircleUserIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlusIcon,
  TargetIcon,
  LayoutGridIcon,
  RocketIcon,
  ChevronDownIcon,
  ListChecksIcon,
  LightbulbIcon,
  ZapIcon,
} from "lucide-react";
import {
  DEFAULT_MODEL_BY_PROVIDER,
  MODEL_OPTIONS_BY_PROVIDER,
  type Feature,
  type Goal,
  type ProjectId,
  type ThreadId,
} from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import { newCommandId, newMessageId, newThreadId } from "~/lib/utils";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { useSidebarGoals, useSidebarFeatures } from "~/lib/sidebarReactQuery";

const PM_THREAD_TITLE_PREFIX = "[Product Manager]";

// ── PM Action parsing ─────────────────────────────────────────────
type PMAction =
  | { type: "create_feature"; name: string; stage: string }
  | { type: "create_goal"; text: string; isMain: boolean }
  | { type: "create_thread"; title: string }
  | { type: "spawn_agent"; feature: string; instructions: string }
  | { type: "activate_harness"; preset: string };

const ACTION_PATTERN =
  /ACTION:(CREATE_FEATURE|CREATE_GOAL|CREATE_THREAD|SPAWN_AGENT|ACTIVATE_HARNESS)\s+(.*?)$/gm;

function parseActions(text: string): { cleanText: string; actions: PMAction[] } {
  const actions: PMAction[] = [];
  const cleanText = text
    .replace(ACTION_PATTERN, (_, type, args) => {
      const params = new Map<string, string>();
      // Accept both double and single quotes, and also escaped quotes
      for (const match of (args as string).matchAll(/(\w+)=(?:"([^"]*?)"|'([^']*?)'|(\S+))/g)) {
        params.set(match[1]!, match[2] ?? match[3] ?? match[4] ?? "");
      }

      switch (type as string) {
        case "CREATE_FEATURE":
          if (params.has("name")) {
            actions.push({
              type: "create_feature",
              name: params.get("name")!,
              stage: params.get("stage") ?? "backlog",
            });
          }
          break;
        case "CREATE_GOAL":
          if (params.has("text")) {
            actions.push({
              type: "create_goal",
              text: params.get("text")!,
              isMain: params.get("isMain") === "true",
            });
          }
          break;
        case "CREATE_THREAD":
          if (params.has("title")) {
            actions.push({ type: "create_thread", title: params.get("title")! });
          }
          break;
        case "SPAWN_AGENT":
          if (params.has("feature") && params.has("instructions")) {
            actions.push({
              type: "spawn_agent",
              feature: params.get("feature")!,
              instructions: params.get("instructions")!,
            });
          }
          break;
        case "ACTIVATE_HARNESS":
          if (params.has("preset")) {
            actions.push({ type: "activate_harness", preset: params.get("preset")! });
          }
          break;
      }
      return "";
    })
    .trim();

  return { cleanText, actions };
}

function buildPMSystemPrompt(context: {
  goals: Goal[];
  features: Feature[];
  threads: Array<{ id: string; title: string; goal: string | null }>;
  brief: string | null;
  memoryCount?: number;
  runningAgents?: number;
}): string {
  const parts: string[] = [];

  parts.push(
    `You are the Product Manager for this project. The user is a non-technical product builder who needs your help turning ideas into working software.

Your job:
1. Help the user clarify WHAT they want to build before any coding starts
2. Break vague ideas into specific, actionable features
3. Suggest the right ORDER to build things (dependencies, MVP, etc.)
4. When the user describes something ambiguous, ask 2-3 specific clarifying questions
5. Recommend creating goals, features, or new threads when appropriate
6. NEVER trust an AI's claim that something is "done" or "complete" — always ask the user to verify by trying it themselves

PLANNING MODE: When the user describes a product or says something like "I want to build X":
1. First set the main goal using ACTION:CREATE_GOAL
2. Then break it into 3-7 features using ACTION:CREATE_FEATURE for each
3. Ask which feature to build first
4. When they choose, use ACTION:SPAWN_AGENT to start building it
5. Suggest building 2-3 features in parallel if they're independent

Example planning response:
"Let's break this down into features:
ACTION:CREATE_GOAL text="Build a restaurant ordering app" isMain="true"
ACTION:CREATE_FEATURE name="Menu Page" stage="backlog"
ACTION:CREATE_FEATURE name="Shopping Cart" stage="backlog"
ACTION:CREATE_FEATURE name="Checkout Flow" stage="backlog"
ACTION:CREATE_FEATURE name="Order Tracking" stage="backlog"

Which would you like to start with? I can kick off multiple features in parallel if they don't depend on each other."

CRITICAL: When the coding AI says it built something, tell the user to TEST IT before moving on. A feature is not done until the user has seen it work. Code that compiles is not the same as code that works.

Be concise. Use bullet points. Never use jargon the user wouldn't understand.
If the user hasn't set up a project brief or goals yet, suggest they do that first.`,
  );

  if (context.brief) {
    parts.push(`\nProject Brief:\n${context.brief}`);
  } else {
    parts.push(
      "\n[No project brief set. If the user asks about building something, suggest they write a brief first via the Goals tab.]",
    );
  }

  if (context.goals.length > 0) {
    const mainGoal = context.goals.find((g) => g.isMain);
    parts.push("\nGoals:");
    if (mainGoal) parts.push(`  Main: ${mainGoal.text}`);
    for (const g of context.goals.filter((g) => !g.isMain)) {
      parts.push(`  - ${g.text}`);
    }
  }

  if (context.features.length > 0) {
    parts.push("\nFeatures:");
    for (const f of context.features) {
      parts.push(`  [${f.stage}] ${f.name}${f.description ? `: ${f.description}` : ""}`);
    }
  }

  if (context.threads.length > 0) {
    parts.push("\nActive threads:");
    for (const t of context.threads.slice(0, 10)) {
      parts.push(`  - ${t.title}${t.goal ? ` (Goal: ${t.goal})` : ""}`);
    }
  }

  // Project state awareness
  const featuresByStage = {
    backlog: context.features.filter((f) => f.stage === "backlog").length,
    in_progress: context.features.filter((f) => f.stage === "in_progress").length,
    done: context.features.filter((f) => f.stage === "done").length,
  };
  parts.push(
    `\nProject state: ${featuresByStage.done} features done, ${featuresByStage.in_progress} in progress, ${featuresByStage.backlog} in backlog.`,
  );
  parts.push(
    "You are focused on THIS project. If the user mentions another project, note that cross-project work is possible but each project has its own context.",
  );
  if (context.memoryCount && context.memoryCount > 0) {
    parts.push(`${context.memoryCount} memories stored from previous conversations.`);
  }
  if (context.runningAgents && context.runningAgents > 0) {
    parts.push(
      `${context.runningAgents} AI agent${context.runningAgents > 1 ? "s" : ""} currently working.`,
    );
  }

  parts.push(
    `\nWhen suggesting actions, use these commands so the user can execute them with one click:
- ACTION:CREATE_FEATURE name="Feature Name" stage="backlog"
- ACTION:CREATE_GOAL text="Goal description" isMain="true"
- ACTION:CREATE_THREAD title="Thread title"

- ACTION:SPAWN_AGENT feature="Feature Name" instructions="What to build"
- ACTION:ACTIVATE_HARNESS preset="careful-builder"

Available harness presets: careful-builder, fast-prototyper, systematic-debugger, code-reviewer, refactorer.
Suggest a harness when appropriate (e.g., "I recommend the Careful Builder for this new feature").

Put each action on its own line. Only include actions you genuinely recommend, not hypothetical ones.
Use SPAWN_AGENT when the user wants to start building a feature — it creates a thread and starts the AI working immediately.
Example: "Let's start building the menu page.\nACTION:SPAWN_AGENT feature=\\"Menu Page\\" instructions=\\"Build a responsive menu page that displays food items with prices, descriptions, and images. Use the existing project styling.\\""`,
  );

  return parts.join("\n");
}

export function PMChatTabContent({
  projectId,
  projectCwd,
}: {
  projectId: ProjectId;
  projectCwd?: string | undefined;
}) {
  const navigate = useNavigate();
  const threads = useStore((store) => store.threads);
  const projects = useStore((store) => store.projects);
  const { goals } = useSidebarGoals(projectId);
  const { features } = useSidebarFeatures(projectId);
  const [brief, setBrief] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pmThreadId, setPmThreadId] = useState<ThreadId | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const projectThreads = useMemo(
    () =>
      threads
        .filter((t) => t.projectId === projectId && !t.title.startsWith(PM_THREAD_TITLE_PREFIX))
        .map((t) => ({ id: t.id, title: t.title, goal: t.goal })),
    [threads, projectId],
  );

  // Find existing PM thread
  const pmThread = useMemo(
    () =>
      threads.find((t) => t.projectId === projectId && t.title.startsWith(PM_THREAD_TITLE_PREFIX)),
    [threads, projectId],
  );

  const pmMessages = useMemo(() => {
    if (!pmThread) return [];
    return pmThread.messages.filter((m) => m.role === "user" || m.role === "assistant");
  }, [pmThread]);

  useEffect(() => {
    if (pmThread) {
      setPmThreadId(pmThread.id);
    }
  }, [pmThread]);

  // Fetch project brief (goals and features come from shared hooks)
  useEffect(() => {
    if (!projectCwd) return;
    const api = readNativeApi();
    if (!api) return;
    api.projects
      .readFile({ cwd: projectCwd, relativePath: ".rowl/project-brief.md" })
      .then((r) => setBrief(r.exists ? r.contents : null))
      .catch(() => {});
  }, [projectCwd]);

  // Clear sending state when message count increases (meaning AI responded)
  const prevMessageCountRef = useRef(pmMessages.length);
  useEffect(() => {
    if (pmMessages.length > prevMessageCountRef.current && isSending) {
      setIsSending(false);
    }
    prevMessageCountRef.current = pmMessages.length;
  }, [pmMessages.length, isSending]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pmMessages.length]);

  const ensurePmThread = useCallback(async (): Promise<ThreadId> => {
    if (pmThreadId) return pmThreadId;

    const api = readNativeApi();
    if (!api) throw new Error("API not available");

    const project = projects.find((p) => p.id === projectId);
    const threadId = newThreadId();
    const now = new Date().toISOString();

    await api.orchestration.dispatchCommand({
      type: "thread.create",
      commandId: newCommandId(),
      threadId,
      projectId,
      title: `${PM_THREAD_TITLE_PREFIX} ${project?.name ?? "Project"}`,
      model: project?.model ?? DEFAULT_MODEL_BY_PROVIDER.codex,
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdAt: now,
    });

    setPmThreadId(threadId);
    return threadId;
  }, [pmThreadId, projectId, projects]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    setIsSending(true);

    try {
      const api = readNativeApi();
      if (!api) return;

      const threadId = await ensurePmThread();

      // Build PM context prompt
      // Get memory count and agent count for PM context
      let memoryCount = 0;
      let runningAgents = 0;
      try {
        const memResult = await api.memory.listByProject({ projectId });
        memoryCount = memResult.memories?.length ?? 0;
      } catch {
        /* non-critical */
      }
      runningAgents = threads.filter(
        (t) => t.projectId === projectId && t.session?.status === "running",
      ).length;

      // Build system prompt — shorter for follow-up messages to save tokens
      const isFirstMessage = pmMessages.length === 0;
      const systemPrompt = isFirstMessage
        ? buildPMSystemPrompt({
            goals,
            features,
            threads: projectThreads,
            brief,
            memoryCount,
            runningAgents,
          })
        : buildPMSystemPrompt({
            goals,
            features,
            threads: [], // Skip thread list for follow-ups (PM already knows)
            brief: null, // Skip brief for follow-ups (PM already has it)
            memoryCount: 0,
            runningAgents,
          });

      const fullMessage = `${systemPrompt}\n\n<!-- USER_MESSAGE -->\n${text}`;

      const now = new Date().toISOString();

      await api.orchestration.dispatchCommand({
        type: "thread.turn.start",
        commandId: newCommandId(),
        threadId,
        message: {
          messageId: newMessageId(),
          role: "user",
          text: fullMessage,
          attachments: [],
        },
        ...(pmModel ? { model: pmModel } : {}),
        runtimeMode: "full-access",
        interactionMode: "default",
        createdAt: now,
      });
    } catch {
      setIsSending(false);
    }
    // Note: isSending is cleared by the effect below when a new assistant message arrives,
    // NOT here — because dispatch returns immediately before the AI responds.
  }, [input, isSending, ensurePmThread, goals, features, projectThreads, brief]);

  const executeAction = useCallback(
    async (action: PMAction) => {
      const api = readNativeApi();
      if (!api) return;
      try {
        switch (action.type) {
          case "create_feature":
            await api.features.create({
              projectId,
              name: action.name,
              description: "",
              stage: action.stage as any,
              createdBy: "pm",
            });
            // Shared hooks auto-invalidate via domain events
            break;
          case "create_goal":
            await api.goals.create({
              projectId,
              text: action.text,
              isMain: action.isMain,
            });
            break;
          case "create_thread": {
            const threadId = newThreadId();
            const project = projects.find((p) => p.id === projectId);
            const now = new Date().toISOString();
            await api.orchestration.dispatchCommand({
              type: "thread.create",
              commandId: newCommandId(),
              threadId,
              projectId,
              title: action.title,
              model: project?.model ?? DEFAULT_MODEL_BY_PROVIDER.codex,
              runtimeMode: "full-access",
              interactionMode: "default",
              branch: null,
              worktreePath: null,
              createdAt: now,
            });
            break;
          }
          case "spawn_agent": {
            // Create a feature entry for tracking
            let featureId: string | null = null;
            try {
              const result = await api.features.create({
                projectId,
                name: action.feature,
                description: "",
                stage: "in_progress",
                createdBy: "pm",
              });
              featureId = (result.feature as any)?.id ?? null;
            } catch {
              /* feature might already exist */
            }

            // Spawn the agent via multi-agent coordinator
            const spawnResult = await api.agents.spawnForFeature({
              projectId,
              featureName: action.feature,
              instructions: action.instructions,
            });

            // Auto-link the feature to the spawned thread
            if (featureId && spawnResult.threadId) {
              await api.featureThreadLinks
                .link({ featureId, threadId: spawnResult.threadId as string })
                .catch(() => {});
            }
            break;
          }
          case "activate_harness": {
            if (pmThreadId) {
              await api.harness
                .activate({ threadId: pmThreadId as any, presetId: action.preset })
                .catch(() => {});
            }
            break;
          }
        }
      } catch {
        // Handle silently
      }
    },
    [projectId, projects],
  );

  const openPmThread = useCallback(() => {
    if (pmThreadId) {
      void navigate({ to: "/$threadId", params: { threadId: pmThreadId } });
    }
  }, [navigate, pmThreadId]);

  // PM model — defaults to project model but user can change
  const [pmModel, setPmModel] = useState<string | null>(null);
  const [activeHarnessName, setActiveHarnessName] = useState<string | null>(null);

  // Fetch active harness for PM thread
  useEffect(() => {
    if (!pmThreadId) return;
    const api = readNativeApi();
    if (!api) return;
    api.harness
      .getActive({ threadId: pmThreadId as string })
      .then((r) => setActiveHarnessName(r.preset?.name ?? null))
      .catch(() => {});
  }, [pmThreadId]);
  const effectiveModel =
    pmModel ?? projects.find((p) => p.id === projectId)?.model ?? DEFAULT_MODEL_BY_PROVIDER.codex;

  // Proactive suggestions based on project state — personalized with actual data
  const projectName = projects.find((p) => p.id === projectId)?.name ?? "project";
  const mainGoal = goals.find((g) => g.isMain);
  const backlogFeatures = features.filter((f) => f.stage === "backlog");
  const inProgressFeatures = features.filter((f) => f.stage === "in_progress");
  const doneFeatures = features.filter((f) => f.stage === "done");

  const suggestions = useMemo(() => {
    const items: Array<{ icon: React.ReactNode; label: string; prompt: string }> = [];

    if (!brief && goals.length === 0) {
      items.push({
        icon: <LightbulbIcon className="size-3" />,
        label: `Describe ${projectName}`,
        prompt: `I want to set up the ${projectName} project. Ask me what I'm building so you can help me plan it.`,
      });
    } else if (!brief) {
      items.push({
        icon: <LightbulbIcon className="size-3" />,
        label: "Write project brief",
        prompt: `Help me write a project brief for ${projectName}. My main goal is: ${mainGoal?.text ?? "not set yet"}.`,
      });
    }

    if (goals.length === 0) {
      items.push({
        icon: <TargetIcon className="size-3" />,
        label: "Set the main goal",
        prompt: `Help me define the main goal for ${projectName}. What's the most important thing to accomplish?`,
      });
    }

    if (features.length === 0 && goals.length > 0) {
      items.push({
        icon: <LayoutGridIcon className="size-3" />,
        label: "Plan features",
        prompt: `My goal is "${mainGoal?.text ?? ""}". Break this into specific features I can build one by one.`,
      });
    }

    if (backlogFeatures.length > 0) {
      const topFeature = backlogFeatures[0]!;
      items.push({
        icon: <RocketIcon className="size-3" />,
        label: `Build "${topFeature.name}"`,
        prompt: `Let's start building the "${topFeature.name}" feature. What's the best approach?`,
      });
    }

    if (inProgressFeatures.length > 0) {
      items.push({
        icon: <ListChecksIcon className="size-3" />,
        label: `Check ${inProgressFeatures.length} in progress`,
        prompt: `I have ${inProgressFeatures.length} feature${inProgressFeatures.length > 1 ? "s" : ""} in progress: ${inProgressFeatures.map((f) => f.name).join(", ")}. What's the status and what should I do next?`,
      });
    }

    if (
      doneFeatures.length > 0 &&
      backlogFeatures.length === 0 &&
      inProgressFeatures.length === 0
    ) {
      items.push({
        icon: <ZapIcon className="size-3" />,
        label: "What's next?",
        prompt: `All ${doneFeatures.length} features are done. What should I build next to improve ${projectName}?`,
      });
    }

    if (items.length === 0) {
      items.push({
        icon: <ZapIcon className="size-3" />,
        label: "Continue building",
        prompt: `What's the most impactful thing I can do on ${projectName} right now?`,
      });
    }

    return items.slice(0, 4); // Max 4 suggestions
  }, [
    brief,
    goals,
    features,
    projectName,
    mainGoal,
    backlogFeatures,
    inProgressFeatures,
    doneFeatures,
  ]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border/40 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <SparklesIcon className="size-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground/80">PM</span>
            {activeHarnessName && (
              <span className="text-[8px] text-amber-400/60 bg-amber-500/10 px-1.5 rounded-full">
                {activeHarnessName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Model picker */}
            <select
              value={pmModel ?? ""}
              onChange={(e) => setPmModel(e.target.value || null)}
              className="text-[9px] text-muted-foreground/50 bg-transparent border-none outline-none cursor-pointer max-w-[120px] hover:text-foreground/70"
              title="Select PM model"
            >
              <option value="">
                {(
                  projects.find((p) => p.id === projectId)?.model ?? DEFAULT_MODEL_BY_PROVIDER.codex
                )
                  .split("/")
                  .pop()
                  ?.slice(0, 20)}{" "}
                (project default)
              </option>
              {Object.entries(MODEL_OPTIONS_BY_PROVIDER).map(([provider, models]) => (
                <optgroup key={provider} label={provider}>
                  {(models as ReadonlyArray<{ slug: string; name: string }>)
                    .slice(0, 5)
                    .map((m) => (
                      <option key={m.slug} value={m.slug}>
                        {m.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {pmThreadId && (
              <button
                type="button"
                onClick={openPmThread}
                className="text-muted-foreground/40 hover:text-foreground/70"
                title="Open in main chat"
              >
                <ExternalLinkIcon className="size-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {pmMessages.length === 0 && !isSending && (
          <div className="py-4">
            <div className="text-center mb-4">
              <SparklesIcon className="size-5 text-primary/40 mx-auto mb-1.5" />
              <p className="text-xs text-foreground/70 font-medium">
                {brief ? "What would you like to work on?" : "Let's set up your project"}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                {goals.length > 0
                  ? `${goals.length} goal${goals.length !== 1 ? "s" : ""}, ${features.length} feature${features.length !== 1 ? "s" : ""}`
                  : "I'll help you plan and build your product."}
              </p>
            </div>

            {/* Proactive suggestions */}
            <div className="space-y-1">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInput(suggestion.prompt);
                    // Auto-send after a tick so the input renders
                    setTimeout(() => {
                      const form = document.querySelector("[data-pm-send]");
                      if (form) (form as HTMLButtonElement).click();
                    }, 100);
                  }}
                  className="w-full flex items-center gap-2 rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-left hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <span className="text-primary/60">{suggestion.icon}</span>
                  <span className="text-xs text-foreground/70">{suggestion.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {pmMessages.map((msg, i) => {
          const displayText =
            msg.role === "user"
              ? (msg.text.split("<!-- USER_MESSAGE -->\n").pop() ?? msg.text)
              : msg.text;

          const { cleanText, actions } =
            msg.role === "assistant"
              ? parseActions(displayText)
              : { cleanText: displayText, actions: [] };

          return (
            <div
              key={`${msg.role}-${i}`}
              className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <SparklesIcon className="size-4 text-primary shrink-0 mt-1" />
              )}
              <div className="max-w-[85%]">
                <div
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-xs",
                    msg.role === "user"
                      ? "bg-primary/10 text-foreground"
                      : "bg-muted/30 text-foreground/80",
                  )}
                >
                  {cleanText}
                </div>
                {actions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {actions.map((action, j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => void executeAction(action)}
                        className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        {action.type === "create_feature" && (
                          <LayoutGridIcon className="size-2.5" />
                        )}
                        {action.type === "create_goal" && <TargetIcon className="size-2.5" />}
                        {action.type === "create_thread" && <PlusIcon className="size-2.5" />}
                        {action.type === "spawn_agent" && <RocketIcon className="size-2.5" />}
                        {action.type === "create_feature" && `Create: ${action.name}`}
                        {action.type === "create_goal" && `Goal: ${action.text.slice(0, 30)}`}
                        {action.type === "create_thread" && `Thread: ${action.title.slice(0, 30)}`}
                        {action.type === "spawn_agent" && `Build: ${action.feature.slice(0, 30)}`}
                        {action.type === "activate_harness" && <ZapIcon className="size-2.5" />}
                        {action.type === "activate_harness" && `Harness: ${action.preset}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <CircleUserIcon className="size-4 text-muted-foreground/40 shrink-0 mt-1" />
              )}
            </div>
          );
        })}

        {isSending && (
          <div className="flex gap-2 justify-start">
            <SparklesIcon className="size-4 text-primary shrink-0 mt-1" />
            <div className="rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground/60">
              <Loader2Icon className="size-3 animate-spin inline mr-1" />
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/60 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="Ask your PM..."
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isSending}
          />
          <Button
            size="xs"
            variant="outline"
            data-pm-send="true"
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isSending}
          >
            <SendIcon className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

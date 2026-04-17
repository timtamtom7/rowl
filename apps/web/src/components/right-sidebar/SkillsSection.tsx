import { useState, useCallback, useEffect } from "react";
import {
  PlusIcon,
  SparklesIcon,
  FileTextIcon,
  Trash2Icon,
  Loader2Icon,
  WandIcon,
} from "lucide-react";
import {
  DEFAULT_MODEL_BY_PROVIDER,
  type ProjectId,
  type ProjectSkill,
  type ThreadId,
} from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import { cn } from "~/lib/utils";
import { newCommandId, newMessageId, newThreadId } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKILL_THREAD_TITLE_PREFIX = "[Skill Generator]";

function toSkillName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function buildSkillGenerationPrompt(topic: string, skillSlug: string): string {
  return `You are a skill file generator. Create a comprehensive SKILL.md file for the following topic:

**Topic:** ${topic}

**Requirements:**
1. Analyze the current project structure, tech stack, and patterns
2. Create a SKILL.md file at \`.rowl/skills/${skillSlug}/SKILL.md\`
3. The file MUST have this exact frontmatter format:
\`\`\`
---
name: ${skillSlug}
description: [one-line description of what this skill does]
---
\`\`\`
4. After the frontmatter, include:
   - A decision tree for when to apply this skill
   - Minimal working examples with copy-paste-ready code
   - Common mistakes with "wrong way / right way" patterns
   - Configuration tables if applicable
   - Cross-references to project files where relevant
5. Keep it 200-500 lines, practical and actionable
6. Base examples on the actual project code and tech stack, not generic examples

Write the file now. Do NOT ask questions — just analyze the project and create the best possible skill file.`;
}

export function SkillsSection({
  projectId,
  projectCwd,
}: {
  projectId: ProjectId;
  projectCwd: string;
}) {
  const projects = useStore((store) => store.projects);
  const threads = useStore((store) => store.threads);
  const [skills, setSkills] = useState<ProjectSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [skillTopic, setSkillTopic] = useState("");
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<string | null>(null);
  const [isEditingSkill, setIsEditingSkill] = useState(false);
  const [editedContent, setEditedContent] = useState("");

  const fetchSkills = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    try {
      const result = await api.projects.listSkills({ cwd: projectCwd });
      setSkills(result.skills as ProjectSkill[]);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [projectCwd]);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  // Re-fetch skills when threads update (AI might have created a new skill file)
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => void fetchSkills(), 3000);
    return () => clearInterval(interval);
  }, [isGenerating, fetchSkills]);

  const generateSkill = useCallback(async () => {
    const topic = skillTopic.trim();
    if (!topic || isGenerating) return;

    const slug = toSkillName(topic);
    if (!SKILL_NAME_PATTERN.test(slug)) return;

    setIsGenerating(true);
    setSkillTopic("");

    try {
      const api = readNativeApi();
      if (!api) return;

      // Find or create skill generator thread
      const existingThread = threads.find(
        (t) =>
          t.projectId === projectId &&
          t.title.startsWith(SKILL_THREAD_TITLE_PREFIX),
      );

      let threadId: ThreadId;
      if (existingThread) {
        threadId = existingThread.id;
      } else {
        threadId = newThreadId();
        const project = projects.find((p) => p.id === projectId);
        const now = new Date().toISOString();
        await api.orchestration.dispatchCommand({
          type: "thread.create",
          commandId: newCommandId(),
          threadId,
          projectId,
          title: `${SKILL_THREAD_TITLE_PREFIX} ${project?.name ?? "Project"}`,
          model: project?.model ?? DEFAULT_MODEL_BY_PROVIDER.codex,
          runtimeMode: "full-access",
          interactionMode: "default",
          branch: null,
          worktreePath: null,
          createdAt: now,
        });
      }

      // Send skill generation turn
      const prompt = buildSkillGenerationPrompt(topic, slug);
      const now = new Date().toISOString();
      await api.orchestration.dispatchCommand({
        type: "thread.turn.start",
        commandId: newCommandId(),
        threadId,
        message: {
          messageId: newMessageId(),
          role: "user",
          text: prompt,
          attachments: [],
        },
        runtimeMode: "full-access",
        interactionMode: "default",
        createdAt: now,
      });

      // Smart polling — check every 3s for up to 2 minutes, stop when skill appears
      const initialCount = skills.length;
      let attempts = 0;
      const maxAttempts = 40; // 40 * 3s = 2 minutes
      const checkInterval = setInterval(() => {
        attempts++;
        void fetchSkills().then(() => {
          // fetchSkills updates the skills state; we check against initial count
          // Since we can't read the updated state in this closure, just use attempts
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            setIsGenerating(false);
          }
        });
      }, 3000);
      // Also set a hard timeout to stop the spinner
      setTimeout(() => {
        clearInterval(checkInterval);
        setIsGenerating(false);
        void fetchSkills();
      }, maxAttempts * 3000);
    } catch {
      setIsGenerating(false);
    }
  }, [skillTopic, isGenerating, threads, projectId, projects, fetchSkills]);

  const deleteSkill = useCallback(
    async (skill: ProjectSkill) => {
      const api = readNativeApi();
      if (!api) return;
      try {
        await api.projects.deleteFile({
          cwd: projectCwd,
          relativePath: skill.relativePath,
        });
        void fetchSkills();
      } catch {
        // Handle silently
      }
    },
    [projectCwd, fetchSkills],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading skills...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
          <div className="flex items-center gap-1.5">
            <SparklesIcon className="size-3.5 text-muted-foreground/60" />
            <span className="text-xs font-medium text-foreground/80">
              Skills ({skills.length})
            </span>
          </div>
          <Button
            size="xs"
            variant="outline"
            className="h-5 text-[10px]"
            onClick={() => setIsCreating(!isCreating)}
            disabled={isGenerating}
          >
            <WandIcon className="size-3 mr-0.5" />
            Generate
          </Button>
        </div>

        {/* AI skill generation input */}
        {isCreating && !isGenerating && (
          <div className="border-b border-border/40 px-3 py-3 space-y-2 bg-accent/10">
            <p className="text-[10px] text-muted-foreground/70">
              Describe the skill you need and the AI will analyze your project and create it.
            </p>
            <Input
              value={skillTopic}
              onChange={(e) => setSkillTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void generateSkill();
                }
              }}
              placeholder="e.g. React component review, API error handling, database migration..."
              className="text-xs h-7"
              autoFocus
            />
            {skillTopic && (
              <p className="text-[10px] text-muted-foreground/50">
                Will create: .rowl/skills/{toSkillName(skillTopic)}/SKILL.md
              </p>
            )}
            <div className="flex justify-end gap-1.5">
              <Button
                size="xs"
                variant="ghost"
                className="h-6 text-[10px]"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                variant="outline"
                className="h-6 text-[10px]"
                onClick={() => void generateSkill()}
                disabled={!skillTopic.trim()}
              >
                <WandIcon className="size-3 mr-0.5" />
                Generate with AI
              </Button>
            </div>
          </div>
        )}

        {/* Generating indicator */}
        {isGenerating && (
          <div className="border-b border-border/40 px-3 py-3 bg-amber-500/5">
            <div className="flex items-center gap-2">
              <Loader2Icon className="size-3.5 animate-spin text-amber-500" />
              <p className="text-xs text-amber-500/80">
                AI is analyzing your project and generating the skill...
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              This may take 30-60 seconds. The skill will appear below when ready.
            </p>
          </div>
        )}

        {/* Existing skills list */}
        {skills.map((skill) => {
          const isExpanded = expandedSkill === skill.name;
          return (
            <div key={skill.name} className="border-b border-border/40">
              <div
                className="flex items-start gap-2 px-3 py-2.5 group hover:bg-accent/15 cursor-pointer"
                onClick={() => {
                  if (isExpanded) {
                    setExpandedSkill(null);
                    setSkillContent(null);
                  } else {
                    setExpandedSkill(skill.name);
                    // Load skill content
                    const api = readNativeApi();
                    if (api && projectCwd) {
                      api.projects
                        .readFile({
                          cwd: projectCwd,
                          relativePath: skill.relativePath,
                        })
                        .then((r) => setSkillContent(r.exists ? r.contents : null))
                        .catch(() => setSkillContent(null));
                    }
                  }
                }}
              >
                <FileTextIcon className="size-3.5 mt-0.5 text-muted-foreground/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80">{skill.name}</p>
                  <p className="text-[10px] text-muted-foreground/50 line-clamp-2 mt-0.5">
                    {skill.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteSkill(skill);
                  }}
                  className="mt-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all"
                  title="Delete skill"
                >
                  <Trash2Icon className="size-3" />
                </button>
              </div>

              {/* Expanded skill content preview */}
              {isExpanded && skillContent !== null && (
                <div className="px-3 pb-3 bg-accent/5">
                  {isEditingSkill ? (
                    <div className="space-y-2">
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="w-full min-h-[150px] rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-mono resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          className="h-5 text-[10px]"
                          onClick={() => setIsEditingSkill(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          className="h-5 text-[10px]"
                          onClick={async () => {
                            const api = readNativeApi();
                            if (api && projectCwd) {
                              await api.projects.writeFile({
                                cwd: projectCwd,
                                relativePath: skill.relativePath,
                                contents: editedContent,
                              });
                              setSkillContent(editedContent);
                              setIsEditingSkill(false);
                              void fetchSkills();
                            }
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <pre className="text-[10px] text-muted-foreground/60 whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto font-mono">
                        {skillContent}
                      </pre>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="h-5 text-[10px] mt-1"
                        onClick={() => {
                          setEditedContent(skillContent);
                          setIsEditingSkill(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {skills.length === 0 && !isCreating && !isGenerating && (
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
            <SparklesIcon className="size-6 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">No skills yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Skills give the AI specialized instructions for specific tasks.
              Describe what you need and the AI will create one.
            </p>
            <Button
              size="xs"
              variant="outline"
              className="mt-3"
              onClick={() => setIsCreating(true)}
            >
              <WandIcon className="size-3 mr-1" />
              Generate your first skill
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

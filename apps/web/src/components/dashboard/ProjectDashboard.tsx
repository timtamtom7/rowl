import { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  FolderIcon,
  ListIcon,
  TargetIcon,
  LayoutGridIcon,
  PlusIcon,
  ActivityIcon,
  BotIcon,
  BrainIcon,
} from "lucide-react";
import type { ProjectId, Goal, Feature } from "@t3tools/contracts";

import { useStore } from "~/store";
import { readNativeApi } from "~/nativeApi";
import { compareThreadsByRecency } from "~/lib/threadOrdering";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

interface ProjectCardData {
  id: ProjectId;
  name: string;
  cwd: string;
  threadCount: number;
  activeThreadCount: number;
  goalCount: number;
  mainGoal: string | null;
  featureCounts: { backlog: number; in_progress: number; done: number; wishlist: number };
  lastActivity: string | null;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ProjectCard({ project, onOpen }: { project: ProjectCardData; onOpen: () => void }) {
  const totalFeatures =
    project.featureCounts.backlog +
    project.featureCounts.in_progress +
    project.featureCounts.done +
    project.featureCounts.wishlist;
  const donePercent =
    totalFeatures > 0 ? Math.round((project.featureCounts.done / totalFeatures) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-xl border border-border/60 bg-card/60 p-4 hover:border-border hover:bg-card/80 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <FolderIcon className="size-4 text-muted-foreground/50 shrink-0" />
          <h3 className="text-sm font-medium text-foreground truncate">{project.name}</h3>
        </div>
        {project.lastActivity && (
          <span className="text-[10px] text-muted-foreground/40 shrink-0">
            {formatRelativeTime(project.lastActivity)}
          </span>
        )}
      </div>

      {project.mainGoal && (
        <p className="mt-2 text-xs text-muted-foreground/70 line-clamp-1">
          <TargetIcon className="inline size-3 mr-1 text-amber-500/70" />
          {project.mainGoal}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/50">
        <span className="flex items-center gap-1">
          <ListIcon className="size-3" />
          {project.threadCount} thread{project.threadCount !== 1 ? "s" : ""}
        </span>
        {project.activeThreadCount > 0 && (
          <span className="flex items-center gap-1 text-emerald-400">
            <BotIcon className="size-3" />
            {project.activeThreadCount} running
          </span>
        )}
        <span className="flex items-center gap-1">
          <TargetIcon className="size-3" />
          {project.goalCount} goal{project.goalCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <LayoutGridIcon className="size-3" />
          {totalFeatures} feature{totalFeatures !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Quick insight */}
      {project.threadCount > 0 && (
        <p className="mt-2 text-[9px] text-muted-foreground/40">
          {project.threadCount} thread{project.threadCount !== 1 ? "s" : ""}
          {totalFeatures > 0 && ` · ${donePercent}% built`}
        </p>
      )}

      {totalFeatures > 0 && (
        <div className="mt-1.5">
          <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-muted/20">
            {project.featureCounts.done > 0 && (
              <div
                className="bg-emerald-500 rounded-full"
                style={{ width: `${(project.featureCounts.done / totalFeatures) * 100}%` }}
              />
            )}
            {project.featureCounts.in_progress > 0 && (
              <div
                className="bg-sky-500 rounded-full"
                style={{ width: `${(project.featureCounts.in_progress / totalFeatures) * 100}%` }}
              />
            )}
            {project.featureCounts.backlog > 0 && (
              <div
                className="bg-muted-foreground/20 rounded-full"
                style={{ width: `${(project.featureCounts.backlog / totalFeatures) * 100}%` }}
              />
            )}
          </div>
          <p className="text-[9px] text-muted-foreground/40 mt-1">{donePercent}% complete</p>
        </div>
      )}
    </button>
  );
}

export function ProjectDashboard() {
  const navigate = useNavigate();
  const projects = useStore((store) => store.projects);
  const threads = useStore((store) => store.threads);
  const [projectGoals, setProjectGoals] = useState<Map<string, Goal[]>>(new Map());
  const [projectFeatures, setProjectFeatures] = useState<Map<string, Feature[]>>(new Map());

  // Fetch goals and features for all projects
  useEffect(() => {
    const api = readNativeApi();
    if (!api || projects.length === 0) return;

    void Promise.all(
      projects.map(async (project) => {
        try {
          const [goalsResult, featuresResult] = await Promise.all([
            api.goals.listByProject({ projectId: project.id }),
            api.features.listByProject({ projectId: project.id }),
          ]);
          setProjectGoals((prev) => new Map(prev).set(project.id, goalsResult.goals as Goal[]));
          setProjectFeatures((prev) =>
            new Map(prev).set(project.id, featuresResult.features as Feature[]),
          );
        } catch {
          // Silently fail per project
        }
      }),
    );
  }, [projects]);

  const projectCards = useMemo<ProjectCardData[]>(() => {
    return projects.map((project) => {
      const projectThreads = threads.filter((t) => t.projectId === project.id);
      const activeThreads = projectThreads.filter(
        (t) => t.session?.status === "running" || t.session?.status === "connecting",
      );
      const goals = projectGoals.get(project.id) ?? [];
      const features = projectFeatures.get(project.id) ?? [];

      const sortedThreads = projectThreads.toSorted(compareThreadsByRecency);
      const lastActivity = sortedThreads[0]?.updatedAt ?? sortedThreads[0]?.createdAt ?? null;

      return {
        id: project.id,
        name: project.name,
        cwd: project.cwd,
        threadCount: projectThreads.length,
        activeThreadCount: activeThreads.length,
        goalCount: goals.length,
        mainGoal: goals.find((g) => g.isMain)?.text ?? null,
        featureCounts: {
          backlog: features.filter((f) => f.stage === "backlog").length,
          in_progress: features.filter((f) => f.stage === "in_progress").length,
          done: features.filter((f) => f.stage === "done").length,
          wishlist: features.filter((f) => f.stage === "wishlist").length,
        },
        lastActivity,
      };
    });
  }, [projects, threads, projectGoals, projectFeatures]);

  const openProject = useCallback(
    (projectId: ProjectId) => {
      const projectThreads = threads
        .filter((t) => t.projectId === projectId)
        .toSorted(compareThreadsByRecency);
      const latestThread = projectThreads[0];
      if (latestThread) {
        void navigate({ to: "/$threadId", params: { threadId: latestThread.id } });
      }
    },
    [navigate, threads],
  );

  const totalThreads = threads.length;
  const totalActiveThreads = threads.filter(
    (t) => t.session?.status === "running" || t.session?.status === "connecting",
  ).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      {/* Control Room Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Control Room</h1>
        <p className="text-xs text-muted-foreground/60 mt-0.5">
          Your projects, agents, and build progress at a glance.
        </p>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FolderIcon className="size-3" />
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <ListIcon className="size-3" />
            {totalThreads} thread{totalThreads !== 1 ? "s" : ""}
          </span>
          {totalActiveThreads > 0 && (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <BotIcon className="size-3 animate-pulse" />
              {totalActiveThreads} agent{totalActiveThreads !== 1 ? "s" : ""} working
            </span>
          )}
        </div>
      </div>

      {/* Project cards */}
      <div className="grid gap-3">
        {projectCards.map((project) => (
          <ProjectCard key={project.id} project={project} onOpen={() => openProject(project.id)} />
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12">
          <FolderIcon className="size-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No projects yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Add a project folder to get started.
          </p>
        </div>
      )}
    </div>
  );
}

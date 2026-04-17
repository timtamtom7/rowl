import { DEFAULT_MODEL_BY_PROVIDER, type ProjectId, type ThreadId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import { APP_DISPLAY_NAME } from "../branding";
import { useAppSettings } from "../appSettings";
import { useNewThreadActions } from "./useNewThread";
import { compareThreadsByRecency } from "../lib/threadOrdering";
import { newCommandId, newProjectId } from "../lib/utils";
import { readNativeApi } from "../nativeApi";
import { useStore } from "../store";
import { useSidebarPreferencesStore } from "../sidebarPreferencesStore";
import { workspacePathsLikelyMatch } from "../lib/projectPathMatching";

function titleFromWorkspacePath(cwd: string): string {
  return cwd.split(/[/\\]/).findLast((segment) => segment.trim().length > 0) ?? cwd;
}

export function useProjectCreationActions() {
  const { settings } = useAppSettings();
  const projects = useStore((store) => store.projects);
  const threads = useStore((store) => store.threads);
  const archivedThreadIds = useSidebarPreferencesStore((store) => store.archivedThreadIds);
  const { openNewThread } = useNewThreadActions();
  const navigate = useNavigate();
  const [newCwd, setNewCwd] = useState("");
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);

  const openThread = useCallback(
    async (threadId: ThreadId) => {
      await navigate({
        to: "/$threadId",
        params: { threadId },
      });
    },
    [navigate],
  );

  const focusBestProjectTarget = useCallback(
    async (projectId: ProjectId) => {
      const latestThread = threads
        .filter((thread) => thread.projectId === projectId && !archivedThreadIds.has(thread.id))
        .toSorted(compareThreadsByRecency)[0];

      if (latestThread) {
        await openThread(latestThread.id);
        return;
      }

      await openNewThread(projectId, {
        envMode: settings.defaultThreadEnvMode,
      });
    },
    [archivedThreadIds, openNewThread, openThread, settings.defaultThreadEnvMode, threads],
  );

  const clearProjectCreationError = useCallback(() => {
    setAddProjectError(null);
  }, []);

  const addProjectFromPath = useCallback(
    async (
      rawCwd: string,
      options?: { skipWizard?: boolean },
    ): Promise<
      | { ok: true; isNew?: boolean; projectId?: ProjectId; cwd?: string }
      | { ok: false; message: string }
    > => {
      const cwd = rawCwd.trim();
      if (!cwd || isAddingProject) {
        return { ok: false, message: "Workspace path is required." };
      }
      const api = readNativeApi();
      if (!api) {
        return { ok: false, message: "Native API not found." };
      }

      setIsAddingProject(true);
      setAddProjectError(null);
      try {
        const existing = projects.find((project) => workspacePathsLikelyMatch(project.cwd, cwd));
        if (existing) {
          await focusBestProjectTarget(existing.id);
          setNewCwd("");
          return { ok: true, isNew: false };
        }

        const projectId = newProjectId();
        await api.orchestration.dispatchCommand({
          type: "project.create",
          commandId: newCommandId(),
          projectId,
          title: titleFromWorkspacePath(cwd),
          workspaceRoot: cwd,
          defaultModel:
            threads.toSorted(compareThreadsByRecency)[0]?.model ??
            DEFAULT_MODEL_BY_PROVIDER.codex,
          createdAt: new Date().toISOString(),
        });
        // Force an immediate snapshot sync so the new project appears in the
        // store before we navigate. Without this, the throttled domain-event
        // sync might not run before the route change, leaving the UI empty.
        try {
          const snapshot = await api.orchestration.getSnapshot();
          useStore.getState().syncServerReadModel(snapshot);
        } catch {
          // Best-effort — the throttled sync will catch up eventually.
        }

        // If not skipping the wizard, return the new project info so the
        // caller can show the setup wizard before opening a thread.
        if (!options?.skipWizard) {
          setNewCwd("");
          return { ok: true, isNew: true, projectId, cwd };
        }

        try {
          await openNewThread(projectId, {
            envMode: settings.defaultThreadEnvMode,
          });
        } catch (error) {
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? `Project was added, but ${APP_DISPLAY_NAME} could not open its first draft thread: ${error.message}`
              : `Project was added, but ${APP_DISPLAY_NAME} could not open its first draft thread.`;
          setAddProjectError(message);
          return { ok: false, message };
        }
        setNewCwd("");
        return { ok: true, isNew: true, projectId, cwd };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add project.";
        setAddProjectError(message);
        return { ok: false, message };
      } finally {
        setIsAddingProject(false);
      }
    },
    [
      focusBestProjectTarget,
      isAddingProject,
      openNewThread,
      projects,
      settings.defaultThreadEnvMode,
    ],
  );

  const pickProjectFolder = useCallback(async (): Promise<string | null> => {
    const api = readNativeApi();
    if (!api || isPickingFolder) {
      return null;
    }

    setIsPickingFolder(true);
    try {
      return await api.dialogs.pickFolder();
    } catch {
      return null;
    } finally {
      setIsPickingFolder(false);
    }
  }, [isPickingFolder]);

  const canAddProject = useMemo(
    () => newCwd.trim().length > 0 && !isAddingProject,
    [isAddingProject, newCwd],
  );

  return {
    addProjectError,
    addProjectFromPath,
    canAddProject,
    clearProjectCreationError,
    isAddingProject,
    isPickingFolder,
    newCwd,
    pickProjectFolder,
    setNewCwd,
  } as const;
}

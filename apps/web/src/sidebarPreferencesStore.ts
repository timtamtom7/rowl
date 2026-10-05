import { ProjectId, ThreadId } from "@t3tools/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { filterArchivedIds, type SidebarProjectSortMode } from "./lib/threadOrdering";

const SIDEBAR_PREFERENCES_STORAGE_KEY = "rowl:sidebar-preferences:v1";

interface PersistedSidebarPreferencesState {
  pinnedProjectIds: ProjectId[];
  archivedProjectIds: ProjectId[];
  pinnedThreadIds: ThreadId[];
  archivedThreadIds: ThreadId[];
  projectSortMode: SidebarProjectSortMode;
  collapsedGroupIds: string[];
  groupOrder: string[];
}

interface SidebarPreferencesState {
  pinnedProjectIds: ReadonlySet<ProjectId>;
  archivedProjectIds: ReadonlySet<ProjectId>;
  pinnedThreadIds: ReadonlySet<ThreadId>;
  archivedThreadIds: ReadonlySet<ThreadId>;
  projectSortMode: SidebarProjectSortMode;
  collapsedGroupIds: ReadonlySet<string>;
  groupOrder: readonly string[];
  setProjectPinned: (projectId: ProjectId, pinned: boolean) => void;
  setProjectArchived: (projectId: ProjectId, archived: boolean) => void;
  setThreadPinned: (threadId: ThreadId, pinned: boolean) => void;
  setThreadArchived: (threadId: ThreadId, archived: boolean) => void;
  setProjectSortMode: (mode: SidebarProjectSortMode) => void;
  setGroupCollapsed: (groupId: string, collapsed: boolean) => void;
  setGroupOrder: (groupOrder: string[]) => void;
  setProjectGroupId: (projectId: ProjectId, groupId: string | null) => void;
  pruneMissing: (input: {
    projectIds: readonly ProjectId[];
    threadIds: readonly ThreadId[];
    groupIds?: readonly string[];
  }) => void;
}

const EMPTY_PROJECT_IDS: ProjectId[] = [];
const EMPTY_THREAD_IDS: ThreadId[] = [];
const EMPTY_GROUP_IDS: string[] = [];

function withToggledId<TId extends string>(
  current: ReadonlySet<TId>,
  id: TId,
  enabled: boolean,
): Set<TId> {
  const next = new Set(current);
  if (enabled) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

export const useSidebarPreferencesStore = create<SidebarPreferencesState>()(
  persist(
    (set) => ({
      pinnedProjectIds: new Set<ProjectId>(),
      archivedProjectIds: new Set<ProjectId>(),
      pinnedThreadIds: new Set<ThreadId>(),
      archivedThreadIds: new Set<ThreadId>(),
      projectSortMode: "recent",
      collapsedGroupIds: new Set<string>(),
      groupOrder: [],
      setProjectPinned: (projectId, pinned) => {
        set((state) => ({
          pinnedProjectIds: withToggledId(state.pinnedProjectIds, projectId, pinned),
        }));
      },
      setProjectArchived: (projectId, archived) => {
        set((state) => ({
          archivedProjectIds: withToggledId(state.archivedProjectIds, projectId, archived),
        }));
      },
      setThreadPinned: (threadId, pinned) => {
        set((state) => ({
          pinnedThreadIds: withToggledId(state.pinnedThreadIds, threadId, pinned),
        }));
      },
      setThreadArchived: (threadId, archived) => {
        set((state) => ({
          archivedThreadIds: withToggledId(state.archivedThreadIds, threadId, archived),
        }));
      },
      setProjectSortMode: (projectSortMode) => {
        set((state) => (state.projectSortMode === projectSortMode ? state : { projectSortMode }));
      },
      setGroupCollapsed: (groupId, collapsed) => {
        set((state) => {
          const next = new Set(state.collapsedGroupIds);
          if (collapsed) {
            next.add(groupId);
          } else {
            next.delete(groupId);
          }
          return { collapsedGroupIds: next };
        });
      },
      setGroupOrder: (groupOrder) => {
        set({ groupOrder });
      },
      setProjectGroupId: (_projectId, _groupId) => {
        // This is handled through orchestration commands, not local state
      },
      pruneMissing: ({ projectIds, threadIds }) => {
        set((state) => {
          const nextPinnedProjectIds = filterArchivedIds({
            ids: state.pinnedProjectIds,
            knownIds: projectIds,
          });
          const nextArchivedProjectIds = filterArchivedIds({
            ids: state.archivedProjectIds,
            knownIds: projectIds,
          });
          const nextPinnedThreadIds = filterArchivedIds({
            ids: state.pinnedThreadIds,
            knownIds: threadIds,
          });
          const nextArchivedThreadIds = filterArchivedIds({
            ids: state.archivedThreadIds,
            knownIds: threadIds,
          });

          if (
            nextPinnedProjectIds.size === state.pinnedProjectIds.size &&
            nextArchivedProjectIds.size === state.archivedProjectIds.size &&
            nextPinnedThreadIds.size === state.pinnedThreadIds.size &&
            nextArchivedThreadIds.size === state.archivedThreadIds.size
          ) {
            return state;
          }

          return {
            pinnedProjectIds: nextPinnedProjectIds,
            archivedProjectIds: nextArchivedProjectIds,
            pinnedThreadIds: nextPinnedThreadIds,
            archivedThreadIds: nextArchivedThreadIds,
          };
        });
      },
    }),
    {
      name: SIDEBAR_PREFERENCES_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedSidebarPreferencesState => ({
        pinnedProjectIds: [...state.pinnedProjectIds],
        archivedProjectIds: [...state.archivedProjectIds],
        pinnedThreadIds: [...state.pinnedThreadIds],
        archivedThreadIds: [...state.archivedThreadIds],
        projectSortMode: state.projectSortMode,
        collapsedGroupIds: [...state.collapsedGroupIds],
        groupOrder: [...state.groupOrder],
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as PersistedSidebarPreferencesState | undefined) ?? {
          pinnedProjectIds: EMPTY_PROJECT_IDS,
          archivedProjectIds: EMPTY_PROJECT_IDS,
          pinnedThreadIds: EMPTY_THREAD_IDS,
          archivedThreadIds: EMPTY_THREAD_IDS,
          projectSortMode: "recent" as const,
          collapsedGroupIds: EMPTY_GROUP_IDS,
          groupOrder: EMPTY_GROUP_IDS,
        };

        return {
          ...currentState,
          pinnedProjectIds: new Set(persisted.pinnedProjectIds),
          archivedProjectIds: new Set(persisted.archivedProjectIds),
          pinnedThreadIds: new Set(persisted.pinnedThreadIds),
          archivedThreadIds: new Set(persisted.archivedThreadIds),
          projectSortMode: persisted.projectSortMode,
          collapsedGroupIds: new Set(persisted.collapsedGroupIds),
          groupOrder: persisted.groupOrder,
        } satisfies SidebarPreferencesState;
      },
    },
  ),
);

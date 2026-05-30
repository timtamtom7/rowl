import {
  ORCHESTRATION_WS_CHANNELS,
  ORCHESTRATION_WS_METHODS,
  type ContextMenuItem,
  CompressContextNodeResult,
  CreateContextNodeResult,
  CreateFeatureResult,
  CreateGoalResult,
  DeleteContextNodeResult,
  GetContextBudgetResult,
  GetContextNodeResult,
  CreateMemoryResult,
  CoreAgentDeleteResponse,
  CoreAgentListResponse,
  CoreAgentMutationResponse,
  CoreAgentSetActiveResponse,
  MemoryNoteDeleteResponse,
  MemoryNoteListResponse,
  MemoryNoteResponse,
  SearchMemoryResult,
  ListMemoryByProjectResult,
  DeleteMemoryResult,
  ProjectListSourceFilesResult,
  GetCodebaseHealthResult,
  UpdateCodebaseHealthResult,
  GetAgentOverviewResult,
  SpawnAgentForFeatureResult,
  DetectConflictsResult,
  ListPromptsResult,
  CreatePromptResult,
  UpdatePromptResult,
  DeletePromptResult,
  ListHarnessPresetsResult,
  ActivateHarnessResult,
  DeactivateHarnessResult,
  DeleteFeatureResult,
  DeleteGoalResult,
  DispatchResult,
  GetFeatureResult,
  GetGoalResult,
  ListContextNodesByProjectResult,
  ListContextNodesByThreadResult,
  ListFeaturesByProjectResult,
  LinkThreadToGoalResult,
  ListGoalsByProjectResult,
  GitCreateWorktreeResult,
  GitListBranchesResult,
  GitPreparePullRequestThreadResult,
  GitPullResult,
  GitResolvePullRequestResult,
  GitRunStackedActionResult,
  GitStatusResult,
  type NativeApi,
  OrchestrationGetFullThreadDiffResult,
  OrchestrationGetSnapshotResult,
  OrchestrationGetTurnDiffResult,
  OrchestrationReplayEventsResult,
  ProjectAgentsFileResult,
  ProjectDraftAgentsFileResult,
  ProjectListCommandTemplatesResult,
  ProjectListSkillsResult,
  ProjectReadFileResult,
  ProjectSearchEntriesResult,
  ProjectWriteFileResult,
  ProjectDeleteFileResult,
  ServerConfigUpdatedPayload,
  ServerConfig,
  ServerCopilotReasoningProbe,
  ServerCopilotUsage,
  ServerOpenCodeCredentialResult,
  RestoreContextNodeResult,
  SetMainGoalResult,
  UpdateFeatureResult,
  UpdateFeatureStageResult,
  ServerOpenCodeState,
  ServerUpsertKeybindingResult,
  TerminalSessionSnapshot,
  ThreadCompactResult,
  ThreadCreateShareResult,
  ThreadGetShareResult,
  ThreadRedoResult,
  ThreadRedoStatusResult,
  ThreadRevokeShareResult,
  ThreadShareStatusResult,
  ThreadUndoResult,
  ThreadImportShareResult,
  UnlinkThreadFromGoalResult,
  UpdateGoalTextResult,
  WS_CHANNELS,
  WS_METHODS,
  type WsWelcomePayload,
} from "@t3tools/contracts";
import { Schema } from "effect";

import { showContextMenuFallback } from "./contextMenuFallback";
import { type TransportState, WsTransport } from "./wsTransport";

let instance: { api: NativeApi; transport: WsTransport } | null = null;
const welcomeListeners = new Set<(payload: WsWelcomePayload) => void>();
const serverConfigUpdatedListeners = new Set<(payload: ServerConfigUpdatedPayload) => void>();
const serverConnectionStateListeners = new Set<() => void>();

function emitServerConnectionStateChange(): void {
  for (const listener of serverConnectionStateListeners) {
    try {
      listener();
    } catch {
      // Swallow listener errors
    }
  }
}

/**
 * Subscribe to the server welcome message. If a welcome was already received
 * before this call, the listener fires synchronously with the cached payload.
 * This avoids the race between WebSocket connect and React effect registration.
 */
export function onServerWelcome(listener: (payload: WsWelcomePayload) => void): () => void {
  welcomeListeners.add(listener);

  const latestWelcome = instance?.transport.getLatestPush(WS_CHANNELS.serverWelcome)?.data ?? null;
  if (latestWelcome) {
    try {
      listener(latestWelcome);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    welcomeListeners.delete(listener);
  };
}

export function getLatestServerWelcome(): WsWelcomePayload | null {
  return instance?.transport.getLatestPush(WS_CHANNELS.serverWelcome)?.data ?? null;
}

/**
 * Subscribe to server config update events. Replays the latest update for
 * late subscribers to avoid missing config validation feedback.
 */
export function onServerConfigUpdated(
  listener: (payload: ServerConfigUpdatedPayload) => void,
): () => void {
  serverConfigUpdatedListeners.add(listener);

  const latestConfig =
    instance?.transport.getLatestPush(WS_CHANNELS.serverConfigUpdated)?.data ?? null;
  if (latestConfig) {
    try {
      listener(latestConfig);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    serverConfigUpdatedListeners.delete(listener);
  };
}

export function subscribeServerConnectionState(listener: () => void): () => void {
  serverConnectionStateListeners.add(listener);

  return () => {
    serverConnectionStateListeners.delete(listener);
  };
}

export function getServerConnectionState(): TransportState {
  return instance?.transport.getState() ?? "connecting";
}

export function createWsNativeApi(): NativeApi {
  if (instance) return instance.api;

  const transport = new WsTransport();
  const requestWithSchema = <T>(method: string, schema: Schema.Schema<T>, params?: unknown) =>
    transport.request(method, params, { resultSchema: schema });

  transport.subscribeState(() => {
    emitServerConnectionStateChange();
  });

  transport.subscribe(WS_CHANNELS.serverWelcome, (message) => {
    const payload = message.data;
    for (const listener of welcomeListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.serverConfigUpdated, (message) => {
    const payload = message.data;
    for (const listener of serverConfigUpdatedListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });

  const api: NativeApi = {
    dialogs: {
      pickFolder: async () => {
        if (!window.desktopBridge) return null;
        return window.desktopBridge.pickFolder();
      },
      confirm: async (message) => {
        if (window.desktopBridge) {
          return window.desktopBridge.confirm(message);
        }
        return window.confirm(message);
      },
    },
    terminal: {
      open: (input) => requestWithSchema(WS_METHODS.terminalOpen, TerminalSessionSnapshot, input),
      write: (input) => requestWithSchema(WS_METHODS.terminalWrite, Schema.Void, input),
      resize: (input) => requestWithSchema(WS_METHODS.terminalResize, Schema.Void, input),
      clear: (input) => requestWithSchema(WS_METHODS.terminalClear, Schema.Void, input),
      restart: (input) =>
        requestWithSchema(WS_METHODS.terminalRestart, TerminalSessionSnapshot, input),
      close: (input) => requestWithSchema(WS_METHODS.terminalClose, Schema.Void, input),
      onEvent: (callback) =>
        transport.subscribe(WS_CHANNELS.terminalEvent, (message) => callback(message.data)),
    },
    projects: {
      searchEntries: (input) =>
        requestWithSchema(WS_METHODS.projectsSearchEntries, ProjectSearchEntriesResult, input),
      readAgentsFile: (input) =>
        requestWithSchema(WS_METHODS.projectsReadAgentsFile, ProjectAgentsFileResult, input),
      draftAgentsFile: (input) =>
        requestWithSchema(WS_METHODS.projectsDraftAgentsFile, ProjectDraftAgentsFileResult, input),
      listCommandTemplates: (input) =>
        requestWithSchema(
          WS_METHODS.projectsListCommandTemplates,
          ProjectListCommandTemplatesResult,
          input,
        ),
      listSkills: (input) =>
        requestWithSchema(WS_METHODS.projectsListSkills, ProjectListSkillsResult, input),
      listSourceFiles: (input) =>
        requestWithSchema(WS_METHODS.projectsListSourceFiles, ProjectListSourceFilesResult, input),
      readFile: (input) =>
        requestWithSchema(WS_METHODS.projectsReadFile, ProjectReadFileResult, input),
      writeFile: (input) =>
        requestWithSchema(WS_METHODS.projectsWriteFile, ProjectWriteFileResult, input),
      deleteFile: (input) =>
        requestWithSchema(WS_METHODS.projectsDeleteFile, ProjectDeleteFileResult, input),
    },
    threads: {
      getShareStatus: (input) =>
        requestWithSchema(WS_METHODS.threadsGetShareStatus, ThreadShareStatusResult, input),
      createShare: (input) =>
        requestWithSchema(WS_METHODS.threadsCreateShare, ThreadCreateShareResult, input),
      getShare: (input) =>
        requestWithSchema(WS_METHODS.threadsGetShare, ThreadGetShareResult, input),
      revokeShare: (input) =>
        requestWithSchema(WS_METHODS.threadsRevokeShare, ThreadRevokeShareResult, input),
      importShare: (input) =>
        requestWithSchema(WS_METHODS.threadsImportShare, ThreadImportShareResult, input),
      compact: (input) => requestWithSchema(WS_METHODS.threadsCompact, ThreadCompactResult, input),
      undo: (input) => requestWithSchema(WS_METHODS.threadsUndo, ThreadUndoResult, input),
      redo: (input) => requestWithSchema(WS_METHODS.threadsRedo, ThreadRedoResult, input),
      getRedoStatus: (input) =>
        requestWithSchema(WS_METHODS.threadsGetRedoStatus, ThreadRedoStatusResult, input),
    },
    review: {
      approve: (input) =>
        requestWithSchema(
          WS_METHODS.reviewApprove,
          Schema.Struct({ success: Schema.Boolean }),
          input,
        ),
      reject: (input) =>
        requestWithSchema(
          WS_METHODS.reviewReject,
          Schema.Struct({ success: Schema.Boolean }),
          input,
        ),
    },
    context: {
      createNode: (input) =>
        requestWithSchema(WS_METHODS.contextCreateNode, CreateContextNodeResult, input),
      getNode: (input) => requestWithSchema(WS_METHODS.contextGetNode, GetContextNodeResult, input),
      listByProject: (input) =>
        requestWithSchema(WS_METHODS.contextListByProject, ListContextNodesByProjectResult, input),
      listByThread: (input) =>
        requestWithSchema(WS_METHODS.contextListByThread, ListContextNodesByThreadResult, input),
      compressNode: (input) =>
        requestWithSchema(WS_METHODS.contextCompressNode, CompressContextNodeResult, input),
      restoreNode: (input) =>
        requestWithSchema(WS_METHODS.contextRestoreNode, RestoreContextNodeResult, input),
      deleteNode: (input) =>
        requestWithSchema(WS_METHODS.contextDeleteNode, DeleteContextNodeResult, input),
      getBudget: (input) =>
        requestWithSchema(WS_METHODS.contextGetBudget, GetContextBudgetResult, input),
    },
    memory: {
      create: (input) => requestWithSchema(WS_METHODS.memoryCreate, CreateMemoryResult, input),
      search: (input) => requestWithSchema(WS_METHODS.memorySearch, SearchMemoryResult, input),
      listByProject: (input) =>
        requestWithSchema(WS_METHODS.memoryListByProject, ListMemoryByProjectResult, input),
      delete: (input) => requestWithSchema(WS_METHODS.memoryDelete, DeleteMemoryResult, input),
    },
    coreAgents: {
      list: (input) => requestWithSchema(WS_METHODS.coreAgentsList, CoreAgentListResponse, input),
      create: (input) =>
        requestWithSchema(WS_METHODS.coreAgentsCreate, CoreAgentMutationResponse, input),
      update: (input) =>
        requestWithSchema(WS_METHODS.coreAgentsUpdate, CoreAgentMutationResponse, input),
      delete: (input) =>
        requestWithSchema(WS_METHODS.coreAgentsDelete, CoreAgentDeleteResponse, input),
      setActive: (input) =>
        requestWithSchema(WS_METHODS.coreAgentsSetActive, CoreAgentSetActiveResponse, input),
    },
    memoryNotes: {
      list: (input) =>
        requestWithSchema(WS_METHODS.memoryNotesList, MemoryNoteListResponse, input),
      read: (input) => requestWithSchema(WS_METHODS.memoryNotesRead, MemoryNoteResponse, input),
      write: (input) => requestWithSchema(WS_METHODS.memoryNotesWrite, MemoryNoteResponse, input),
      delete: (input) =>
        requestWithSchema(WS_METHODS.memoryNotesDelete, MemoryNoteDeleteResponse, input),
      onChanged: (callback) =>
        transport.subscribe(WS_CHANNELS.memoryChanged, (message) => callback(message.data)),
    },
    codebaseHealth: {
      getSummary: (input) =>
        requestWithSchema(WS_METHODS.codebaseHealthSummary, GetCodebaseHealthResult, input),
      updateHealth: (input) =>
        requestWithSchema(WS_METHODS.codebaseUpdateHealth, UpdateCodebaseHealthResult, input),
    },
    prompts: {
      list: (input) => requestWithSchema(WS_METHODS.promptsList, ListPromptsResult, input),
      create: (input) => requestWithSchema(WS_METHODS.promptsCreate, CreatePromptResult, input),
      update: (input) => requestWithSchema(WS_METHODS.promptsUpdate, UpdatePromptResult, input),
      delete: (input) => requestWithSchema(WS_METHODS.promptsDelete, DeletePromptResult, input),
    },
    harness: {
      listPresets: () =>
        requestWithSchema(WS_METHODS.harnessPresetsList, ListHarnessPresetsResult, {}),
      activate: (input) =>
        requestWithSchema(WS_METHODS.harnessActivate, ActivateHarnessResult, input),
      deactivate: (input) =>
        requestWithSchema(WS_METHODS.harnessDeactivate, DeactivateHarnessResult, input),
      getActive: (input: { threadId: string }) =>
        requestWithSchema(
          WS_METHODS.harnessGetActive,
          Schema.Struct({
            preset: Schema.NullOr(Schema.Struct({ id: Schema.String, name: Schema.String })),
          }),
          input,
        ),
    },
    featureThreadLinks: {
      link: (input: { featureId: string; threadId: string }) =>
        requestWithSchema(WS_METHODS.featureThreadLink, Schema.Struct({}), input),
      unlink: (input: { featureId: string; threadId: string }) =>
        requestWithSchema(WS_METHODS.featureThreadUnlink, Schema.Struct({}), input),
      getLinks: (input: { projectId: string }) =>
        requestWithSchema(
          WS_METHODS.featureThreadGetLinks,
          Schema.Struct({
            links: Schema.Array(
              Schema.Struct({
                featureId: Schema.String,
                threadId: Schema.String,
                createdAt: Schema.String,
              }),
            ),
          }),
          input,
        ),
    },
    agents: {
      getOverview: (input) =>
        requestWithSchema(WS_METHODS.agentOverview, GetAgentOverviewResult, input),
      spawnForFeature: (input) =>
        requestWithSchema(WS_METHODS.agentSpawnForFeature, SpawnAgentForFeatureResult, input),
      detectConflicts: (input) =>
        requestWithSchema(WS_METHODS.agentDetectConflicts, DetectConflictsResult, input),
    },
    features: {
      create: (input) => requestWithSchema(WS_METHODS.featuresCreate, CreateFeatureResult, input),
      get: (input) => requestWithSchema(WS_METHODS.featuresGet, GetFeatureResult, input),
      listByProject: (input) =>
        requestWithSchema(WS_METHODS.featuresListByProject, ListFeaturesByProjectResult, input),
      update: (input) => requestWithSchema(WS_METHODS.featuresUpdate, UpdateFeatureResult, input),
      updateStage: (input) =>
        requestWithSchema(WS_METHODS.featuresUpdateStage, UpdateFeatureStageResult, input),
      delete: (input) => requestWithSchema(WS_METHODS.featuresDelete, DeleteFeatureResult, input),
    },
    goals: {
      create: (input) => requestWithSchema(WS_METHODS.goalsCreate, CreateGoalResult, input),
      get: (input) => requestWithSchema(WS_METHODS.goalsGet, GetGoalResult, input),
      listByProject: (input) =>
        requestWithSchema(WS_METHODS.goalsListByProject, ListGoalsByProjectResult, input),
      setMain: (input) => requestWithSchema(WS_METHODS.goalsSetMain, SetMainGoalResult, input),
      linkThread: (input) =>
        requestWithSchema(WS_METHODS.goalsLinkThread, LinkThreadToGoalResult, input),
      unlinkThread: (input) =>
        requestWithSchema(WS_METHODS.goalsUnlinkThread, UnlinkThreadFromGoalResult, input),
      updateText: (input) =>
        requestWithSchema(WS_METHODS.goalsUpdateText, UpdateGoalTextResult, input),
      delete: (input) => requestWithSchema(WS_METHODS.goalsDelete, DeleteGoalResult, input),
    },
    shell: {
      openInEditor: (cwd, editor) =>
        requestWithSchema(WS_METHODS.shellOpenInEditor, Schema.Void, { cwd, editor }),
      openExternal: async (url) => {
        if (window.desktopBridge) {
          const opened = await window.desktopBridge.openExternal(url);
          if (!opened) {
            throw new Error("Unable to open link.");
          }
          return;
        }

        // Some mobile browsers can return null here even when the tab opens.
        // Avoid false negatives and let the browser handle popup policy.
        window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    git: {
      pull: (input) => requestWithSchema(WS_METHODS.gitPull, GitPullResult, input),
      status: (input) => requestWithSchema(WS_METHODS.gitStatus, GitStatusResult, input),
      runStackedAction: (input) =>
        requestWithSchema(WS_METHODS.gitRunStackedAction, GitRunStackedActionResult, input),
      listBranches: (input) =>
        requestWithSchema(WS_METHODS.gitListBranches, GitListBranchesResult, input),
      createWorktree: (input) =>
        requestWithSchema(WS_METHODS.gitCreateWorktree, GitCreateWorktreeResult, input),
      removeWorktree: (input) =>
        requestWithSchema(WS_METHODS.gitRemoveWorktree, Schema.Void, input),
      createBranch: (input) => requestWithSchema(WS_METHODS.gitCreateBranch, Schema.Void, input),
      checkout: (input) => requestWithSchema(WS_METHODS.gitCheckout, Schema.Void, input),
      init: (input) => requestWithSchema(WS_METHODS.gitInit, Schema.Void, input),
      resolvePullRequest: (input) =>
        requestWithSchema(WS_METHODS.gitResolvePullRequest, GitResolvePullRequestResult, input),
      preparePullRequestThread: (input) =>
        requestWithSchema(
          WS_METHODS.gitPreparePullRequestThread,
          GitPreparePullRequestThreadResult,
          input,
        ),
    },
    contextMenu: {
      show: async <T extends string>(
        items: readonly ContextMenuItem<T>[],
        position?: { x: number; y: number },
      ): Promise<T | null> => {
        if (window.desktopBridge) {
          return window.desktopBridge.showContextMenu(items, position) as Promise<T | null>;
        }
        return showContextMenuFallback(items, position);
      },
    },
    server: {
      getConfig: () => requestWithSchema(WS_METHODS.serverGetConfig, ServerConfig),
      getCopilotUsage: () =>
        requestWithSchema(WS_METHODS.serverGetCopilotUsage, ServerCopilotUsage),
      probeCopilotReasoning: (input) =>
        requestWithSchema(
          WS_METHODS.serverProbeCopilotReasoning,
          ServerCopilotReasoningProbe,
          input,
        ),
      getOpenCodeState: (input) =>
        requestWithSchema(WS_METHODS.serverGetOpenCodeState, ServerOpenCodeState, input ?? {}),
      upsertKeybinding: (input) =>
        requestWithSchema(WS_METHODS.serverUpsertKeybinding, ServerUpsertKeybindingResult, input),
      addOpenCodeCredential: (input) =>
        requestWithSchema(
          WS_METHODS.serverAddOpenCodeCredential,
          ServerOpenCodeCredentialResult,
          input,
        ),
      removeOpenCodeCredential: (input) =>
        requestWithSchema(
          WS_METHODS.serverRemoveOpenCodeCredential,
          ServerOpenCodeCredentialResult,
          input,
        ),
    },
    orchestration: {
      getSnapshot: () =>
        requestWithSchema(ORCHESTRATION_WS_METHODS.getSnapshot, OrchestrationGetSnapshotResult),
      dispatchCommand: (command) =>
        requestWithSchema(ORCHESTRATION_WS_METHODS.dispatchCommand, DispatchResult, { command }),
      getTurnDiff: (input) =>
        requestWithSchema(
          ORCHESTRATION_WS_METHODS.getTurnDiff,
          OrchestrationGetTurnDiffResult,
          input,
        ),
      getFullThreadDiff: (input) =>
        requestWithSchema(
          ORCHESTRATION_WS_METHODS.getFullThreadDiff,
          OrchestrationGetFullThreadDiffResult,
          input,
        ),
      replayEvents: (fromSequenceExclusive) =>
        requestWithSchema(ORCHESTRATION_WS_METHODS.replayEvents, OrchestrationReplayEventsResult, {
          fromSequenceExclusive,
        }).then((events) => Array.from(events)),
      onDomainEvent: (callback) =>
        transport.subscribe(ORCHESTRATION_WS_CHANNELS.domainEvent, (message) =>
          callback(message.data),
        ),
    },
  };

  instance = { api, transport };
  return api;
}

import type {
  CompressContextNodeInput,
  CompressContextNodeResult,
  CreateContextNodeInput,
  CreateContextNodeResult,
  DeleteContextNodeInput,
  DeleteContextNodeResult,
  GetContextBudgetInput,
  GetContextBudgetResult,
  GetContextNodeInput,
  GetContextNodeResult,
  ListContextNodesByProjectInput,
  ListContextNodesByProjectResult,
  ListContextNodesByThreadInput,
  ListContextNodesByThreadResult,
  RestoreContextNodeInput,
  RestoreContextNodeResult,
} from "./context";
import type {
  CreateMemoryInput,
  CreateMemoryResult,
  DeleteMemoryInput,
  DeleteMemoryResult,
  ListMemoryByProjectInput,
  ListMemoryByProjectResult,
  SearchMemoryInput,
  SearchMemoryResult,
} from "./memory";
import type {
  GetCodebaseHealthInput,
  GetCodebaseHealthResult,
  UpdateCodebaseHealthInput,
  UpdateCodebaseHealthResult,
} from "./codebaseHealth";
import type {
  GetAgentOverviewInput,
  GetAgentOverviewResult,
  SpawnAgentForFeatureInput,
  SpawnAgentForFeatureResult,
  DetectConflictsInput,
  DetectConflictsResult,
} from "./multiAgent";
import type {
  ListPromptsInput,
  ListPromptsResult,
  CreatePromptInput,
  CreatePromptResult,
  UpdatePromptInput,
  UpdatePromptResult,
  DeletePromptInput,
  DeletePromptResult,
  ListHarnessPresetsResult,
  ActivateHarnessInput,
  ActivateHarnessResult,
  DeactivateHarnessInput,
  DeactivateHarnessResult,
} from "./projectPrompts";
import type {
  CreateFeatureInput,
  CreateFeatureResult,
  DeleteFeatureInput,
  DeleteFeatureResult,
  GetFeatureInput,
  GetFeatureResult,
  ListFeaturesByProjectInput,
  ListFeaturesByProjectResult,
  UpdateFeatureInput,
  UpdateFeatureResult,
  UpdateFeatureStageInput,
  UpdateFeatureStageResult,
} from "./features";
import type {
  CreateGoalInput,
  CreateGoalResult,
  DeleteGoalInput,
  DeleteGoalResult,
  GetGoalInput,
  GetGoalResult,
  LinkThreadToGoalInput,
  LinkThreadToGoalResult,
  ListGoalsByProjectInput,
  ListGoalsByProjectResult,
  SetMainGoalInput,
  SetMainGoalResult,
  UnlinkThreadFromGoalInput,
  UnlinkThreadFromGoalResult,
  UpdateGoalTextInput,
  UpdateGoalTextResult,
} from "./goals";
import type {
  GitCheckoutInput,
  GitCreateBranchInput,
  GitPreparePullRequestThreadInput,
  GitPreparePullRequestThreadResult,
  GitPullRequestRefInput,
  GitCreateWorktreeInput,
  GitCreateWorktreeResult,
  GitInitInput,
  GitListBranchesInput,
  GitListBranchesResult,
  GitPullInput,
  GitPullResult,
  GitRemoveWorktreeInput,
  GitResolvePullRequestResult,
  GitRunStackedActionInput,
  GitRunStackedActionResult,
  GitStatusInput,
  GitStatusResult,
} from "./git";
import type {
  ProjectAgentsFileInput,
  ProjectAgentsFileResult,
  ProjectDraftAgentsFileInput,
  ProjectDraftAgentsFileResult,
  ProjectListCommandTemplatesInput,
  ProjectListCommandTemplatesResult,
  ProjectListSkillsInput,
  ProjectListSourceFilesInput,
  ProjectListSourceFilesResult,
  ProjectListSkillsResult,
  ProjectSearchEntriesInput,
  ProjectSearchEntriesResult,
  ProjectReadFileInput,
  ProjectReadFileResult,
  ProjectWriteFileInput,
  ProjectWriteFileResult,
  ProjectDeleteFileInput,
  ProjectDeleteFileResult,
} from "./project";
import type {
  ServerConfig,
  ServerCopilotReasoningProbe,
  ServerCopilotReasoningProbeInput,
  ServerCopilotUsage,
  ServerOpenCodeAddCredentialInput,
  ServerOpenCodeCredentialResult,
  ServerOpenCodeRemoveCredentialInput,
  ServerOpenCodeState,
  ServerOpenCodeStateInput,
} from "./server";
import type {
  TerminalClearInput,
  TerminalCloseInput,
  TerminalEvent,
  TerminalOpenInput,
  TerminalResizeInput,
  TerminalRestartInput,
  TerminalSessionSnapshot,
  TerminalWriteInput,
} from "./terminal";
import type { ServerUpsertKeybindingInput, ServerUpsertKeybindingResult } from "./server";
import type {
  ClientOrchestrationCommand,
  OrchestrationGetFullThreadDiffInput,
  OrchestrationGetFullThreadDiffResult,
  OrchestrationGetTurnDiffInput,
  OrchestrationGetTurnDiffResult,
  OrchestrationEvent,
  OrchestrationReadModel,
} from "./orchestration";
import type {
  ThreadCompactInput,
  ThreadCompactResult,
  ThreadCreateShareInput,
  ThreadCreateShareResult,
  ThreadGetShareInput,
  ThreadGetShareResult,
  ThreadImportShareInput,
  ThreadImportShareResult,
  ThreadRedoInput,
  ThreadRedoResult,
  ThreadRedoStatusInput,
  ThreadRedoStatusResult,
  ThreadRevokeShareInput,
  ThreadRevokeShareResult,
  ThreadShareStatusInput,
  ThreadShareStatusResult,
  ThreadUndoInput,
  ThreadUndoResult,
} from "./threadFeatures";
import { EditorId } from "./editor";

export interface ContextMenuItem<T extends string = string> {
  id: T;
  label: string;
  destructive?: boolean;
}

export type DesktopUpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

export type DesktopRuntimeArch = "arm64" | "x64" | "other";
export type DesktopTheme = "light" | "dark" | "system";
export type DesktopSecretKey = "openRouterApiKey" | "kimiApiKey";

export interface DesktopRuntimeInfo {
  hostArch: DesktopRuntimeArch;
  appArch: DesktopRuntimeArch;
  runningUnderArm64Translation: boolean;
}

export interface DesktopUpdateState {
  enabled: boolean;
  status: DesktopUpdateStatus;
  currentVersion: string;
  hostArch: DesktopRuntimeArch;
  appArch: DesktopRuntimeArch;
  runningUnderArm64Translation: boolean;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadPercent: number | null;
  checkedAt: string | null;
  message: string | null;
  errorContext: "check" | "download" | "install" | null;
  canRetry: boolean;
}

export interface DesktopUpdateActionResult {
  accepted: boolean;
  completed: boolean;
  state: DesktopUpdateState;
}

export interface DesktopBridge {
  getWsUrl: () => string | null;
  onBackendWsUrlUpdated: (listener: (url: string | null) => void) => () => void;
  getSecret: (key: DesktopSecretKey) => Promise<string | null>;
  setSecret: (key: DesktopSecretKey, value: string | null) => Promise<void>;
  pickFolder: () => Promise<string | null>;
  confirm: (message: string) => Promise<boolean>;
  setTheme: (theme: DesktopTheme) => Promise<void>;
  showContextMenu: <T extends string>(
    items: readonly ContextMenuItem<T>[],
    position?: { x: number; y: number },
  ) => Promise<T | null>;
  openExternal: (url: string) => Promise<boolean>;
  onMenuAction: (listener: (action: string) => void) => () => void;
  getUpdateState: () => Promise<DesktopUpdateState>;
  downloadUpdate: () => Promise<DesktopUpdateActionResult>;
  installUpdate: () => Promise<DesktopUpdateActionResult>;
  onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
}

export interface NativeApi {
  dialogs: {
    pickFolder: () => Promise<string | null>;
    confirm: (message: string) => Promise<boolean>;
  };
  terminal: {
    open: (input: TerminalOpenInput) => Promise<TerminalSessionSnapshot>;
    write: (input: TerminalWriteInput) => Promise<void>;
    resize: (input: TerminalResizeInput) => Promise<void>;
    clear: (input: TerminalClearInput) => Promise<void>;
    restart: (input: TerminalRestartInput) => Promise<TerminalSessionSnapshot>;
    close: (input: TerminalCloseInput) => Promise<void>;
    onEvent: (callback: (event: TerminalEvent) => void) => () => void;
  };
  projects: {
    searchEntries: (input: ProjectSearchEntriesInput) => Promise<ProjectSearchEntriesResult>;
    readAgentsFile: (input: ProjectAgentsFileInput) => Promise<ProjectAgentsFileResult>;
    draftAgentsFile: (input: ProjectDraftAgentsFileInput) => Promise<ProjectDraftAgentsFileResult>;
    listCommandTemplates: (
      input: ProjectListCommandTemplatesInput,
    ) => Promise<ProjectListCommandTemplatesResult>;
    listSkills: (input: ProjectListSkillsInput) => Promise<ProjectListSkillsResult>;
    listSourceFiles: (
      input: ProjectListSourceFilesInput,
    ) => Promise<ProjectListSourceFilesResult>;
    readFile: (input: ProjectReadFileInput) => Promise<ProjectReadFileResult>;
    writeFile: (input: ProjectWriteFileInput) => Promise<ProjectWriteFileResult>;
    deleteFile: (input: ProjectDeleteFileInput) => Promise<ProjectDeleteFileResult>;
  };
  threads: {
    getShareStatus: (input: ThreadShareStatusInput) => Promise<ThreadShareStatusResult>;
    createShare: (input: ThreadCreateShareInput) => Promise<ThreadCreateShareResult>;
    getShare: (input: ThreadGetShareInput) => Promise<ThreadGetShareResult>;
    revokeShare: (input: ThreadRevokeShareInput) => Promise<ThreadRevokeShareResult>;
    importShare: (input: ThreadImportShareInput) => Promise<ThreadImportShareResult>;
    compact: (input: ThreadCompactInput) => Promise<ThreadCompactResult>;
    undo: (input: ThreadUndoInput) => Promise<ThreadUndoResult>;
    redo: (input: ThreadRedoInput) => Promise<ThreadRedoResult>;
    getRedoStatus: (input: ThreadRedoStatusInput) => Promise<ThreadRedoStatusResult>;
  };
  review: {
    approve: (input: { threadId: string; turnId: string }) => Promise<{ success: boolean }>;
    reject: (input: {
      threadId: string;
      turnId: string;
      turnCount: number;
    }) => Promise<{ success: boolean }>;
  };
  context: {
    createNode: (input: CreateContextNodeInput) => Promise<CreateContextNodeResult>;
    getNode: (input: GetContextNodeInput) => Promise<GetContextNodeResult>;
    listByProject: (
      input: ListContextNodesByProjectInput,
    ) => Promise<ListContextNodesByProjectResult>;
    listByThread: (input: ListContextNodesByThreadInput) => Promise<ListContextNodesByThreadResult>;
    compressNode: (input: CompressContextNodeInput) => Promise<CompressContextNodeResult>;
    restoreNode: (input: RestoreContextNodeInput) => Promise<RestoreContextNodeResult>;
    deleteNode: (input: DeleteContextNodeInput) => Promise<DeleteContextNodeResult>;
    getBudget: (input: GetContextBudgetInput) => Promise<GetContextBudgetResult>;
  };
  memory: {
    create: (input: CreateMemoryInput) => Promise<CreateMemoryResult>;
    search: (input: SearchMemoryInput) => Promise<SearchMemoryResult>;
    listByProject: (input: ListMemoryByProjectInput) => Promise<ListMemoryByProjectResult>;
    delete: (input: DeleteMemoryInput) => Promise<DeleteMemoryResult>;
  };
  codebaseHealth: {
    getSummary: (input: GetCodebaseHealthInput) => Promise<GetCodebaseHealthResult>;
    updateHealth: (input: UpdateCodebaseHealthInput) => Promise<UpdateCodebaseHealthResult>;
  };
  prompts: {
    list: (input: ListPromptsInput) => Promise<ListPromptsResult>;
    create: (input: CreatePromptInput) => Promise<CreatePromptResult>;
    update: (input: UpdatePromptInput) => Promise<UpdatePromptResult>;
    delete: (input: DeletePromptInput) => Promise<DeletePromptResult>;
  };
  harness: {
    listPresets: () => Promise<ListHarnessPresetsResult>;
    activate: (input: ActivateHarnessInput) => Promise<ActivateHarnessResult>;
    deactivate: (input: DeactivateHarnessInput) => Promise<DeactivateHarnessResult>;
    getActive: (input: { threadId: string }) => Promise<{ preset: { id: string; name: string } | null }>;
  };
  featureThreadLinks: {
    link: (input: { featureId: string; threadId: string }) => Promise<unknown>;
    unlink: (input: { featureId: string; threadId: string }) => Promise<unknown>;
    getLinks: (input: {
      projectId: string;
    }) => Promise<{
      readonly links: ReadonlyArray<{
        readonly featureId: string;
        readonly threadId: string;
        readonly createdAt: string;
      }>;
    }>;
  };
  agents: {
    getOverview: (input: GetAgentOverviewInput) => Promise<GetAgentOverviewResult>;
    spawnForFeature: (input: SpawnAgentForFeatureInput) => Promise<SpawnAgentForFeatureResult>;
    detectConflicts: (input: DetectConflictsInput) => Promise<DetectConflictsResult>;
  };
  features: {
    create: (input: CreateFeatureInput) => Promise<CreateFeatureResult>;
    get: (input: GetFeatureInput) => Promise<GetFeatureResult>;
    listByProject: (input: ListFeaturesByProjectInput) => Promise<ListFeaturesByProjectResult>;
    update: (input: UpdateFeatureInput) => Promise<UpdateFeatureResult>;
    updateStage: (input: UpdateFeatureStageInput) => Promise<UpdateFeatureStageResult>;
    delete: (input: DeleteFeatureInput) => Promise<DeleteFeatureResult>;
  };
  goals: {
    create: (input: CreateGoalInput) => Promise<CreateGoalResult>;
    get: (input: GetGoalInput) => Promise<GetGoalResult>;
    listByProject: (input: ListGoalsByProjectInput) => Promise<ListGoalsByProjectResult>;
    setMain: (input: SetMainGoalInput) => Promise<SetMainGoalResult>;
    linkThread: (input: LinkThreadToGoalInput) => Promise<LinkThreadToGoalResult>;
    unlinkThread: (input: UnlinkThreadFromGoalInput) => Promise<UnlinkThreadFromGoalResult>;
    updateText: (input: UpdateGoalTextInput) => Promise<UpdateGoalTextResult>;
    delete: (input: DeleteGoalInput) => Promise<DeleteGoalResult>;
  };
  shell: {
    openInEditor: (cwd: string, editor: EditorId) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  git: {
    // Existing branch/worktree API
    listBranches: (input: GitListBranchesInput) => Promise<GitListBranchesResult>;
    createWorktree: (input: GitCreateWorktreeInput) => Promise<GitCreateWorktreeResult>;
    removeWorktree: (input: GitRemoveWorktreeInput) => Promise<void>;
    createBranch: (input: GitCreateBranchInput) => Promise<void>;
    checkout: (input: GitCheckoutInput) => Promise<void>;
    init: (input: GitInitInput) => Promise<void>;
    resolvePullRequest: (input: GitPullRequestRefInput) => Promise<GitResolvePullRequestResult>;
    preparePullRequestThread: (
      input: GitPreparePullRequestThreadInput,
    ) => Promise<GitPreparePullRequestThreadResult>;
    // Stacked action API
    pull: (input: GitPullInput) => Promise<GitPullResult>;
    status: (input: GitStatusInput) => Promise<GitStatusResult>;
    runStackedAction: (input: GitRunStackedActionInput) => Promise<GitRunStackedActionResult>;
  };
  contextMenu: {
    show: <T extends string>(
      items: readonly ContextMenuItem<T>[],
      position?: { x: number; y: number },
    ) => Promise<T | null>;
  };
  server: {
    getConfig: () => Promise<ServerConfig>;
    getCopilotUsage: () => Promise<ServerCopilotUsage>;
    probeCopilotReasoning: (
      input: ServerCopilotReasoningProbeInput,
    ) => Promise<ServerCopilotReasoningProbe>;
    getOpenCodeState: (input?: ServerOpenCodeStateInput) => Promise<ServerOpenCodeState>;
    upsertKeybinding: (input: ServerUpsertKeybindingInput) => Promise<ServerUpsertKeybindingResult>;
    addOpenCodeCredential: (
      input: ServerOpenCodeAddCredentialInput,
    ) => Promise<ServerOpenCodeCredentialResult>;
    removeOpenCodeCredential: (
      input: ServerOpenCodeRemoveCredentialInput,
    ) => Promise<ServerOpenCodeCredentialResult>;
  };
  orchestration: {
    getSnapshot: () => Promise<OrchestrationReadModel>;
    dispatchCommand: (command: ClientOrchestrationCommand) => Promise<{ sequence: number }>;
    getTurnDiff: (input: OrchestrationGetTurnDiffInput) => Promise<OrchestrationGetTurnDiffResult>;
    getFullThreadDiff: (
      input: OrchestrationGetFullThreadDiffInput,
    ) => Promise<OrchestrationGetFullThreadDiffResult>;
    replayEvents: (fromSequenceExclusive: number) => Promise<OrchestrationEvent[]>;
    onDomainEvent: (callback: (event: OrchestrationEvent) => void) => () => void;
  };
}

import { Schema, Struct } from "effect";
import {
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
  TurnId,
} from "./baseSchemas";

import {
  ClientOrchestrationCommand,
  DispatchResult,
  OrchestrationEvent,
  OrchestrationGetFullThreadDiffResult,
  ORCHESTRATION_WS_CHANNELS,
  OrchestrationGetFullThreadDiffInput,
  OrchestrationGetSnapshotResult,
  ORCHESTRATION_WS_METHODS,
  OrchestrationGetSnapshotInput,
  OrchestrationGetTurnDiffResult,
  OrchestrationGetTurnDiffInput,
  OrchestrationReplayEventsResult,
  OrchestrationReplayEventsInput,
} from "./orchestration";
import {
  CreateWorktreeInput,
  CreateWorktreeResult,
  GetWorktreeInfoInput,
  GitCreateWorktreeResult,
  GitCheckoutInput,
  GitCherryPickInput,
  GitCreateBranchInput,
  GitIntegrationResult,
  GitMergeBranchInput,
  GitPreparePullRequestThreadInput,
  GitPreparePullRequestThreadResult,
  GitCreateWorktreeInput,
  GitInitInput,
  GitListBranchesInput,
  GitListBranchesResult,
  GitPullInput,
  GitPullResult,
  GitPullRequestRefInput,
  GitResolvePullRequestResult,
  GitRemoveWorktreeInput,
  GitRunStackedActionInput,
  GitRunStackedActionResult,
  GitStatusInput,
  GitStatusResult,
  ListWorktreesInput,
  ListWorktreesResult,
  RemoveWorktreeInput,
  WorktreeInfo,
} from "./git";
import {
  TerminalClearInput,
  TerminalCloseInput,
  TerminalEvent,
  TerminalOpenInput,
  TerminalResizeInput,
  TerminalRestartInput,
  TerminalSessionSnapshot,
  TerminalWriteInput,
} from "./terminal";
import { KeybindingRule } from "./keybindings";
import {
  ProjectAgentsFileInput,
  ProjectAgentsFileResult,
  ProjectDraftAgentsFileInput,
  ProjectDraftAgentsFileResult,
  ProjectListCommandTemplatesInput,
  ProjectListCommandTemplatesResult,
  ProjectListSkillsInput,
  ProjectListSkillsResult,
  ProjectListSourceFilesInput,
  ProjectListSourceFilesResult,
  ProjectSearchEntriesInput,
  ProjectSearchEntriesResult,
  ProjectReadFileInput,
  ProjectReadFileResult,
  ProjectWriteFileInput,
  ProjectWriteFileResult,
  ProjectDeleteFileInput,
  ProjectDeleteFileResult,
} from "./project";
import {
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
import { OpenInEditorInput } from "./editor";

// Review schemas (inline — simple structures)
const ReviewApproveInput = Schema.Struct({
  threadId: ThreadId,
  turnId: TurnId,
});
type ReviewApproveInput = typeof ReviewApproveInput.Type;
const ReviewApproveResult = Schema.Struct({ success: Schema.Boolean });

const ReviewRejectInput = Schema.Struct({
  threadId: ThreadId,
  turnId: TurnId,
  turnCount: Schema.Number,
});
type ReviewRejectInput = typeof ReviewRejectInput.Type;
const ReviewRejectResult = Schema.Struct({ success: Schema.Boolean });
import {
  ServerConfig,
  ServerConfigUpdatedPayload,
  ServerCopilotReasoningProbe,
  ServerCopilotReasoningProbeInput,
  ServerCopilotUsage,
  ServerOpenCodeAddCredentialInput,
  ServerOpenCodeCredentialResult,
  ServerOpenCodeRemoveCredentialInput,
  ServerOpenCodeState,
  ServerOpenCodeStateInput,
  ServerUpsertKeybindingResult,
} from "./server";
import {
  CompressContextNodeInput,
  CompressContextNodeResult,
  CreateContextNodeInput,
  CreateContextNodeResult,
  DeleteContextNodeInput,
  DeleteContextNodeResult,
  GetContextNodeInput,
  GetContextNodeResult,
  ListContextNodesByProjectInput,
  ListContextNodesByProjectResult,
  ListContextNodesByThreadInput,
  ListContextNodesByThreadResult,
  RestoreContextNodeInput,
  RestoreContextNodeResult,
  GetContextBudgetInput,
  GetContextBudgetResult,
} from "./context";
import {
  CreateMemoryInput,
  CreateMemoryResult,
  DeleteMemoryInput,
  DeleteMemoryResult,
  ListMemoryByProjectInput,
  ListMemoryByProjectResult,
  SearchMemoryInput,
  SearchMemoryResult,
} from "./memory";
import {
  CoreAgentActiveChangedEvent,
  CoreAgentCreateRequest,
  CoreAgentDeleteRequest,
  CoreAgentDeleteResponse,
  CoreAgentListRequest,
  CoreAgentListResponse,
  CoreAgentMutationResponse,
  CoreAgentSetActiveRequest,
  CoreAgentSetActiveResponse,
  CoreAgentUpdateRequest,
  MemoryChangedEvent,
  MemoryNoteDeleteRequest,
  MemoryNoteDeleteResponse,
  MemoryNoteListRequest,
  MemoryNoteListResponse,
  MemoryNoteReadRequest,
  MemoryNoteResponse,
  MemoryNoteWriteRequest,
} from "./core-agent";
import {
  GetCodebaseHealthInput,
  GetCodebaseHealthResult,
  UpdateCodebaseHealthInput,
  UpdateCodebaseHealthResult,
} from "./codebaseHealth";
import {
  GetAgentOverviewInput,
  GetAgentOverviewResult,
  SpawnAgentForFeatureInput,
  SpawnAgentForFeatureResult,
  DetectConflictsInput,
  DetectConflictsResult,
} from "./multiAgent";
import {
  ListPromptsInput,
  ListPromptsResult,
  CreatePromptInput,
  CreatePromptResult,
  UpdatePromptInput,
  UpdatePromptResult,
  DeletePromptInput,
  DeletePromptResult,
  HarnessPreset,
  ListHarnessPresetsResult,
  ActivateHarnessInput,
  ActivateHarnessResult,
  DeactivateHarnessInput,
  DeactivateHarnessResult,
} from "./projectPrompts";
import {
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
import {
  CreateGoalInput,
  CreateGoalResult,
  DeleteGoalInput,
  DeleteGoalResult,
  GetGoalAncestorsInput,
  GetGoalAncestorsResult,
  GetGoalChildrenInput,
  GetGoalChildrenResult,
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
  UpdateGoalInput,
  UpdateGoalResult,
  UpdateGoalTextInput,
  UpdateGoalTextResult,
} from "./goals";
import {
  CreateGoalDocumentInput,
  DeleteGoalDocumentInput,
  DeleteGoalDocumentResult,
  GoalDocumentResult,
  ListDocumentsByGoalInput,
  ListDocumentsByGoalResult,
  ReadGoalDocumentInput,
  UpdateGoalDocumentInput,
  WriteGoalDocumentInput,
} from "./documents";
import {
  ApprovalGateResult,
  ApproveInput,
  CreateApprovalInput,
  IsGoalApprovedInput,
  IsGoalApprovedResult,
  ListApprovalsByGoalInput,
  ListApprovalsByGoalResult,
  RejectInput,
} from "./approvals";

// ── WebSocket RPC Method Names ───────────────────────────────────────

export const WS_METHODS = {
  // Project registry methods
  projectsList: "projects.list",
  projectsAdd: "projects.add",
  projectsRemove: "projects.remove",
  projectsSearchEntries: "projects.searchEntries",
  projectsReadAgentsFile: "projects.readAgentsFile",
  projectsDraftAgentsFile: "projects.draftAgentsFile",
  projectsListCommandTemplates: "projects.listCommandTemplates",
  projectsListSourceFiles: "projects.listSourceFiles",
  projectsListSkills: "projects.listSkills",
  projectsReadFile: "projects.readFile",
  projectsWriteFile: "projects.writeFile",
  projectsDeleteFile: "projects.deleteFile",

  // Thread utility methods
  threadsGetShareStatus: "threads.getShareStatus",
  threadsCreateShare: "threads.createShare",
  threadsGetShare: "threads.getShare",
  threadsRevokeShare: "threads.revokeShare",
  threadsImportShare: "threads.importShare",
  threadsCompact: "threads.compact",
  threadsUndo: "threads.undo",
  threadsRedo: "threads.redo",
  threadsGetRedoStatus: "threads.getRedoStatus",

  // Review methods
  reviewApprove: "review.approve",
  reviewReject: "review.reject",

  // Shell methods
  shellOpenInEditor: "shell.openInEditor",

  // Git methods
  gitPull: "git.pull",
  gitStatus: "git.status",
  gitRunStackedAction: "git.runStackedAction",
  gitListBranches: "git.listBranches",
  gitCreateWorktree: "git.createWorktree",
  gitRemoveWorktree: "git.removeWorktree",
  gitCherryPick: "git.cherryPick",
  gitMergeBranch: "git.mergeBranch",
  gitCreateBranch: "git.createBranch",
  gitCheckout: "git.checkout",
  gitInit: "git.init",
  gitResolvePullRequest: "git.resolvePullRequest",
  gitPreparePullRequestThread: "git.preparePullRequestThread",

  // Managed worktree methods
  worktreesCreate: "worktrees.create",
  worktreesList: "worktrees.list",
  worktreesRemove: "worktrees.remove",
  worktreesInfo: "worktrees.info",

  // Terminal methods
  terminalOpen: "terminal.open",
  terminalWrite: "terminal.write",
  terminalResize: "terminal.resize",
  terminalClear: "terminal.clear",
  terminalRestart: "terminal.restart",
  terminalClose: "terminal.close",

  // Server meta
  serverGetConfig: "server.getConfig",
  serverGetCopilotUsage: "server.getCopilotUsage",
  serverProbeCopilotReasoning: "server.probeCopilotReasoning",
  serverGetOpenCodeState: "server.getOpenCodeState",
  serverUpsertKeybinding: "server.upsertKeybinding",
  serverAddOpenCodeCredential: "server.addOpenCodeCredential",
  serverRemoveOpenCodeCredential: "server.removeOpenCodeCredential",

  // Features methods
  featuresCreate: "features.create",
  featuresGet: "features.get",
  featuresListByProject: "features.listByProject",
  featuresUpdate: "features.update",
  featuresUpdateStage: "features.updateStage",
  featuresDelete: "features.delete",

  // Goals methods
  goalsCreate: "goals.create",
  goalsList: "goals.list",
  goalsUpdate: "goals.update",
  goalsGet: "goals.get",
  goalsListByProject: "goals.listByProject",
  goalsSetMain: "goals.setMain",
  goalsLinkThread: "goals.linkThread",
  goalsUnlinkThread: "goals.unlinkThread",
  goalsUpdateText: "goals.updateText",
  goalsChildren: "goals.children",
  goalsAncestors: "goals.ancestors",
  goalsDelete: "goals.delete",

  // Goal document methods
  documentsList: "documents.list",
  documentsRead: "documents.read",
  documentsWrite: "documents.write",
  documentsCreate: "documents.create",
  documentsUpdate: "documents.update",
  documentsDelete: "documents.delete",

  // Goal approval methods
  approvalsList: "approvals.list",
  approvalsCreate: "approvals.create",
  approvalsApprove: "approvals.approve",
  approvalsReject: "approvals.reject",
  approvalsIsGoalApproved: "approvals.isGoalApproved",

  // Context methods
  contextCreateNode: "context.createNode",
  contextGetNode: "context.getNode",
  contextListByProject: "context.listByProject",
  contextListByThread: "context.listByThread",
  contextCompressNode: "context.compressNode",
  contextRestoreNode: "context.restoreNode",
  contextDeleteNode: "context.deleteNode",
  contextGetBudget: "context.getBudget",

  // Codebase Intelligence
  codebaseHealthSummary: "codebase.healthSummary",
  codebaseUpdateHealth: "codebase.updateHealth",

  // Project prompts + harnesses
  promptsList: "prompts.list",
  promptsCreate: "prompts.create",
  promptsUpdate: "prompts.update",
  promptsDelete: "prompts.delete",
  harnessPresetsList: "harness.presets.list",
  harnessActivate: "harness.activate",
  harnessDeactivate: "harness.deactivate",
  harnessGetActive: "harness.getActive",

  // Feature-thread linking
  featureThreadLink: "featureThread.link",
  featureThreadUnlink: "featureThread.unlink",
  featureThreadGetLinks: "featureThread.getLinks",

  // Multi-agent
  agentOverview: "agent.overview",
  agentSpawnForFeature: "agent.spawnForFeature",
  agentDetectConflicts: "agent.detectConflicts",

  // Memory methods
  memoryCreate: "memory.create",
  memorySearch: "memory.search",
  memoryListByProject: "memory.listByProject",
  memoryDelete: "memory.delete",

  // Core-agent methods
  coreAgentsList: "coreAgents.list",
  coreAgentsCreate: "coreAgents.create",
  coreAgentsUpdate: "coreAgents.update",
  coreAgentsDelete: "coreAgents.delete",
  coreAgentsSetActive: "coreAgents.setActive",

  // Memory Palace methods
  memoryNotesList: "memoryNotes.list",
  memoryNotesRead: "memoryNotes.read",
  memoryNotesWrite: "memoryNotes.write",
  memoryNotesDelete: "memoryNotes.delete",
} as const;

// ── Push Event Channels ──────────────────────────────────────────────

export const WS_CHANNELS = {
  terminalEvent: "terminal.event",
  serverWelcome: "server.welcome",
  serverConfigUpdated: "server.configUpdated",
  fileActivity: "file.activity",
  organizingChanged: "organizing.changed",
  coreAgentActiveChanged: "coreAgent.activeChanged",
  memoryChanged: "memory-changed",
} as const;

/** File activity event pushed when Claude reads/writes/creates files during a turn */
export const FileActivityEvent = Schema.Struct({
  threadId: Schema.String,
  filePath: Schema.String,
  action: Schema.Literals(["read", "write", "create", "delete"]),
  timestamp: Schema.String,
});
export type FileActivityEvent = typeof FileActivityEvent.Type;

export const OrganizingChangedEvent = Schema.Struct({
  domain: Schema.Literals(["goals", "documents", "approvals"]),
  action: TrimmedNonEmptyString,
  projectId: Schema.optional(ProjectId),
  goalId: Schema.optional(TrimmedNonEmptyString),
  documentId: Schema.optional(TrimmedNonEmptyString),
  approvalId: Schema.optional(TrimmedNonEmptyString),
  timestamp: IsoDateTime,
});
export type OrganizingChangedEvent = typeof OrganizingChangedEvent.Type;

// -- Tagged Union of all request body schemas ─────────────────────────

const tagRequestBody = <const Tag extends string, const Fields extends Schema.Struct.Fields>(
  tag: Tag,
  schema: Schema.Struct<Fields>,
) =>
  schema.mapFields(
    Struct.assign({ _tag: Schema.tag(tag) }),
    // PreserveChecks is safe here. No existing schema should have checks depending on the tag
    { unsafePreserveChecks: true },
  );

const WebSocketRequestBody = Schema.Union([
  // Orchestration methods
  tagRequestBody(
    ORCHESTRATION_WS_METHODS.dispatchCommand,
    Schema.Struct({ command: ClientOrchestrationCommand }),
  ),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getSnapshot, OrchestrationGetSnapshotInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getTurnDiff, OrchestrationGetTurnDiffInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getFullThreadDiff, OrchestrationGetFullThreadDiffInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.replayEvents, OrchestrationReplayEventsInput),

  // Project Search
  tagRequestBody(WS_METHODS.projectsSearchEntries, ProjectSearchEntriesInput),
  tagRequestBody(WS_METHODS.projectsReadAgentsFile, ProjectAgentsFileInput),
  tagRequestBody(WS_METHODS.projectsDraftAgentsFile, ProjectDraftAgentsFileInput),
  tagRequestBody(WS_METHODS.projectsListCommandTemplates, ProjectListCommandTemplatesInput),
  tagRequestBody(WS_METHODS.projectsListSourceFiles, ProjectListSourceFilesInput),
  tagRequestBody(WS_METHODS.projectsListSkills, ProjectListSkillsInput),
  tagRequestBody(WS_METHODS.projectsReadFile, ProjectReadFileInput),
  tagRequestBody(WS_METHODS.projectsWriteFile, ProjectWriteFileInput),
  tagRequestBody(WS_METHODS.projectsDeleteFile, ProjectDeleteFileInput),

  // Thread utility methods
  tagRequestBody(WS_METHODS.threadsGetShareStatus, ThreadShareStatusInput),
  tagRequestBody(WS_METHODS.threadsCreateShare, ThreadCreateShareInput),
  tagRequestBody(WS_METHODS.threadsGetShare, ThreadGetShareInput),
  tagRequestBody(WS_METHODS.threadsRevokeShare, ThreadRevokeShareInput),
  tagRequestBody(WS_METHODS.threadsImportShare, ThreadImportShareInput),
  tagRequestBody(WS_METHODS.threadsCompact, ThreadCompactInput),
  tagRequestBody(WS_METHODS.threadsUndo, ThreadUndoInput),
  tagRequestBody(WS_METHODS.threadsRedo, ThreadRedoInput),
  tagRequestBody(WS_METHODS.threadsGetRedoStatus, ThreadRedoStatusInput),

  // Review methods
  tagRequestBody(WS_METHODS.reviewApprove, ReviewApproveInput),
  tagRequestBody(WS_METHODS.reviewReject, ReviewRejectInput),

  // Shell methods
  tagRequestBody(WS_METHODS.shellOpenInEditor, OpenInEditorInput),

  // Git methods
  tagRequestBody(WS_METHODS.gitPull, GitPullInput),
  tagRequestBody(WS_METHODS.gitStatus, GitStatusInput),
  tagRequestBody(WS_METHODS.gitRunStackedAction, GitRunStackedActionInput),
  tagRequestBody(WS_METHODS.gitListBranches, GitListBranchesInput),
  tagRequestBody(WS_METHODS.gitCreateWorktree, GitCreateWorktreeInput),
  tagRequestBody(WS_METHODS.gitRemoveWorktree, GitRemoveWorktreeInput),
  tagRequestBody(WS_METHODS.gitCherryPick, GitCherryPickInput),
  tagRequestBody(WS_METHODS.gitMergeBranch, GitMergeBranchInput),
  tagRequestBody(WS_METHODS.gitCreateBranch, GitCreateBranchInput),
  tagRequestBody(WS_METHODS.gitCheckout, GitCheckoutInput),
  tagRequestBody(WS_METHODS.gitInit, GitInitInput),
  tagRequestBody(WS_METHODS.gitResolvePullRequest, GitPullRequestRefInput),
  tagRequestBody(WS_METHODS.gitPreparePullRequestThread, GitPreparePullRequestThreadInput),

  // Managed worktree methods
  tagRequestBody(WS_METHODS.worktreesCreate, CreateWorktreeInput),
  tagRequestBody(WS_METHODS.worktreesList, ListWorktreesInput),
  tagRequestBody(WS_METHODS.worktreesRemove, RemoveWorktreeInput),
  tagRequestBody(WS_METHODS.worktreesInfo, GetWorktreeInfoInput),

  // Terminal methods
  tagRequestBody(WS_METHODS.terminalOpen, TerminalOpenInput),
  tagRequestBody(WS_METHODS.terminalWrite, TerminalWriteInput),
  tagRequestBody(WS_METHODS.terminalResize, TerminalResizeInput),
  tagRequestBody(WS_METHODS.terminalClear, TerminalClearInput),
  tagRequestBody(WS_METHODS.terminalRestart, TerminalRestartInput),
  tagRequestBody(WS_METHODS.terminalClose, TerminalCloseInput),

  // Server meta
  tagRequestBody(WS_METHODS.serverGetConfig, Schema.Struct({})),
  tagRequestBody(WS_METHODS.serverGetCopilotUsage, Schema.Struct({})),
  tagRequestBody(WS_METHODS.serverProbeCopilotReasoning, ServerCopilotReasoningProbeInput),
  tagRequestBody(WS_METHODS.serverGetOpenCodeState, ServerOpenCodeStateInput),
  tagRequestBody(WS_METHODS.serverUpsertKeybinding, KeybindingRule),
  tagRequestBody(WS_METHODS.serverAddOpenCodeCredential, ServerOpenCodeAddCredentialInput),
  tagRequestBody(WS_METHODS.serverRemoveOpenCodeCredential, ServerOpenCodeRemoveCredentialInput),

  // Features methods
  tagRequestBody(WS_METHODS.featuresCreate, CreateFeatureInput),
  tagRequestBody(WS_METHODS.featuresGet, GetFeatureInput),
  tagRequestBody(WS_METHODS.featuresListByProject, ListFeaturesByProjectInput),
  tagRequestBody(WS_METHODS.featuresUpdate, UpdateFeatureInput),
  tagRequestBody(WS_METHODS.featuresUpdateStage, UpdateFeatureStageInput),
  tagRequestBody(WS_METHODS.featuresDelete, DeleteFeatureInput),

  // Goals methods
  tagRequestBody(WS_METHODS.goalsCreate, CreateGoalInput),
  tagRequestBody(WS_METHODS.goalsList, ListGoalsByProjectInput),
  tagRequestBody(WS_METHODS.goalsUpdate, UpdateGoalInput),
  tagRequestBody(WS_METHODS.goalsGet, GetGoalInput),
  tagRequestBody(WS_METHODS.goalsListByProject, ListGoalsByProjectInput),
  tagRequestBody(WS_METHODS.goalsSetMain, SetMainGoalInput),
  tagRequestBody(WS_METHODS.goalsLinkThread, LinkThreadToGoalInput),
  tagRequestBody(WS_METHODS.goalsUnlinkThread, UnlinkThreadFromGoalInput),
  tagRequestBody(WS_METHODS.goalsUpdateText, UpdateGoalTextInput),
  tagRequestBody(WS_METHODS.goalsChildren, GetGoalChildrenInput),
  tagRequestBody(WS_METHODS.goalsAncestors, GetGoalAncestorsInput),
  tagRequestBody(WS_METHODS.goalsDelete, DeleteGoalInput),

  // Goal document methods
  tagRequestBody(WS_METHODS.documentsList, ListDocumentsByGoalInput),
  tagRequestBody(WS_METHODS.documentsRead, ReadGoalDocumentInput),
  tagRequestBody(WS_METHODS.documentsWrite, WriteGoalDocumentInput),
  tagRequestBody(WS_METHODS.documentsCreate, CreateGoalDocumentInput),
  tagRequestBody(WS_METHODS.documentsUpdate, UpdateGoalDocumentInput),
  tagRequestBody(WS_METHODS.documentsDelete, DeleteGoalDocumentInput),

  // Goal approval methods
  tagRequestBody(WS_METHODS.approvalsList, ListApprovalsByGoalInput),
  tagRequestBody(WS_METHODS.approvalsCreate, CreateApprovalInput),
  tagRequestBody(WS_METHODS.approvalsApprove, ApproveInput),
  tagRequestBody(WS_METHODS.approvalsReject, RejectInput),
  tagRequestBody(WS_METHODS.approvalsIsGoalApproved, IsGoalApprovedInput),

  // Context methods
  tagRequestBody(WS_METHODS.contextCreateNode, CreateContextNodeInput),
  tagRequestBody(WS_METHODS.contextGetNode, GetContextNodeInput),
  tagRequestBody(WS_METHODS.contextListByProject, ListContextNodesByProjectInput),
  tagRequestBody(WS_METHODS.contextListByThread, ListContextNodesByThreadInput),
  tagRequestBody(WS_METHODS.contextCompressNode, CompressContextNodeInput),
  tagRequestBody(WS_METHODS.contextRestoreNode, RestoreContextNodeInput),
  tagRequestBody(WS_METHODS.contextDeleteNode, DeleteContextNodeInput),
  tagRequestBody(WS_METHODS.contextGetBudget, GetContextBudgetInput),
  tagRequestBody(WS_METHODS.memoryCreate, CreateMemoryInput),
  tagRequestBody(WS_METHODS.memorySearch, SearchMemoryInput),
  tagRequestBody(WS_METHODS.memoryListByProject, ListMemoryByProjectInput),
  tagRequestBody(WS_METHODS.memoryDelete, DeleteMemoryInput),
  tagRequestBody(WS_METHODS.coreAgentsList, CoreAgentListRequest),
  tagRequestBody(WS_METHODS.coreAgentsCreate, CoreAgentCreateRequest),
  tagRequestBody(WS_METHODS.coreAgentsUpdate, CoreAgentUpdateRequest),
  tagRequestBody(WS_METHODS.coreAgentsDelete, CoreAgentDeleteRequest),
  tagRequestBody(WS_METHODS.coreAgentsSetActive, CoreAgentSetActiveRequest),
  tagRequestBody(WS_METHODS.memoryNotesList, MemoryNoteListRequest),
  tagRequestBody(WS_METHODS.memoryNotesRead, MemoryNoteReadRequest),
  tagRequestBody(WS_METHODS.memoryNotesWrite, MemoryNoteWriteRequest),
  tagRequestBody(WS_METHODS.memoryNotesDelete, MemoryNoteDeleteRequest),
  tagRequestBody(WS_METHODS.codebaseHealthSummary, GetCodebaseHealthInput),
  tagRequestBody(WS_METHODS.codebaseUpdateHealth, UpdateCodebaseHealthInput),
  tagRequestBody(WS_METHODS.promptsList, ListPromptsInput),
  tagRequestBody(WS_METHODS.promptsCreate, CreatePromptInput),
  tagRequestBody(WS_METHODS.promptsUpdate, UpdatePromptInput),
  tagRequestBody(WS_METHODS.promptsDelete, DeletePromptInput),
  tagRequestBody(WS_METHODS.harnessPresetsList, Schema.Struct({})),
  tagRequestBody(WS_METHODS.harnessActivate, ActivateHarnessInput),
  tagRequestBody(WS_METHODS.harnessDeactivate, DeactivateHarnessInput),
  tagRequestBody(WS_METHODS.harnessGetActive, Schema.Struct({ threadId: Schema.String })),
  tagRequestBody(
    WS_METHODS.featureThreadLink,
    Schema.Struct({ featureId: Schema.String, threadId: Schema.String }),
  ),
  tagRequestBody(
    WS_METHODS.featureThreadUnlink,
    Schema.Struct({ featureId: Schema.String, threadId: Schema.String }),
  ),
  tagRequestBody(WS_METHODS.featureThreadGetLinks, Schema.Struct({ projectId: Schema.String })),
  tagRequestBody(WS_METHODS.agentOverview, GetAgentOverviewInput),
  tagRequestBody(WS_METHODS.agentSpawnForFeature, SpawnAgentForFeatureInput),
  tagRequestBody(WS_METHODS.agentDetectConflicts, DetectConflictsInput),
]);

export const WebSocketRequest = Schema.Struct({
  id: TrimmedNonEmptyString,
  body: WebSocketRequestBody,
});
export type WebSocketRequest = typeof WebSocketRequest.Type;

export const WebSocketResponse = Schema.Struct({
  id: TrimmedNonEmptyString,
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(
    Schema.Struct({
      message: Schema.String,
    }),
  ),
});
export type WebSocketResponse = typeof WebSocketResponse.Type;

export const WsPushSequence = NonNegativeInt;
export type WsPushSequence = typeof WsPushSequence.Type;

export const WsWelcomePayload = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  projectName: TrimmedNonEmptyString,
  bootstrapProjectId: Schema.optional(ProjectId),
  bootstrapThreadId: Schema.optional(ThreadId),
});
export type WsWelcomePayload = typeof WsWelcomePayload.Type;

export interface WsPushPayloadByChannel {
  readonly [WS_CHANNELS.serverWelcome]: WsWelcomePayload;
  readonly [WS_CHANNELS.serverConfigUpdated]: typeof ServerConfigUpdatedPayload.Type;
  readonly [WS_CHANNELS.terminalEvent]: typeof TerminalEvent.Type;
  readonly [ORCHESTRATION_WS_CHANNELS.domainEvent]: OrchestrationEvent;
  readonly [WS_CHANNELS.fileActivity]: FileActivityEvent;
  readonly [WS_CHANNELS.organizingChanged]: OrganizingChangedEvent;
  readonly [WS_CHANNELS.coreAgentActiveChanged]: typeof CoreAgentActiveChangedEvent.Type;
  readonly [WS_CHANNELS.memoryChanged]: typeof MemoryChangedEvent.Type;
}

export type WsPushChannel = keyof WsPushPayloadByChannel;
export type WsPushData<C extends WsPushChannel> = WsPushPayloadByChannel[C];

const makeWsPushSchema = <const Channel extends string, Payload extends Schema.Schema<any>>(
  channel: Channel,
  payload: Payload,
) =>
  Schema.Struct({
    type: Schema.Literal("push"),
    sequence: WsPushSequence,
    channel: Schema.Literal(channel),
    data: payload,
  });

export const WsPushServerWelcome = makeWsPushSchema(WS_CHANNELS.serverWelcome, WsWelcomePayload);
export const WsPushServerConfigUpdated = makeWsPushSchema(
  WS_CHANNELS.serverConfigUpdated,
  ServerConfigUpdatedPayload,
);
export const WsPushTerminalEvent = makeWsPushSchema(WS_CHANNELS.terminalEvent, TerminalEvent);
export const WsPushOrchestrationDomainEvent = makeWsPushSchema(
  ORCHESTRATION_WS_CHANNELS.domainEvent,
  OrchestrationEvent,
);
export const WsPushFileActivity = makeWsPushSchema(WS_CHANNELS.fileActivity, FileActivityEvent);
export const WsPushOrganizingChanged = makeWsPushSchema(
  WS_CHANNELS.organizingChanged,
  OrganizingChangedEvent,
);
export const WsPushCoreAgentActiveChanged = makeWsPushSchema(
  WS_CHANNELS.coreAgentActiveChanged,
  CoreAgentActiveChangedEvent,
);
export const WsPushMemoryChanged = makeWsPushSchema(WS_CHANNELS.memoryChanged, MemoryChangedEvent);

export const WsPushChannelSchema = Schema.Literals([
  WS_CHANNELS.serverWelcome,
  WS_CHANNELS.serverConfigUpdated,
  WS_CHANNELS.terminalEvent,
  WS_CHANNELS.fileActivity,
  WS_CHANNELS.organizingChanged,
  WS_CHANNELS.coreAgentActiveChanged,
  WS_CHANNELS.memoryChanged,
  ORCHESTRATION_WS_CHANNELS.domainEvent,
]);
export type WsPushChannelSchema = typeof WsPushChannelSchema.Type;

export const WsPush = Schema.Union([
  WsPushServerWelcome,
  WsPushServerConfigUpdated,
  WsPushTerminalEvent,
  WsPushFileActivity,
  WsPushOrganizingChanged,
  WsPushCoreAgentActiveChanged,
  WsPushMemoryChanged,
  WsPushOrchestrationDomainEvent,
]);
export type WsPush = typeof WsPush.Type;

export type WsPushMessage<C extends WsPushChannel> = Extract<WsPush, { channel: C }>;

export const WsPushEnvelopeBase = Schema.Struct({
  type: Schema.Literal("push"),
  sequence: WsPushSequence,
  channel: WsPushChannelSchema,
  data: Schema.Unknown,
});
export type WsPushEnvelopeBase = typeof WsPushEnvelopeBase.Type;

// ── Union of all server → client messages ─────────────────────────────

export const WsResponse = Schema.Union([WebSocketResponse, WsPush]);
export type WsResponse = typeof WsResponse.Type;

export const WsRpcResultSchemaByMethod = {
  [ORCHESTRATION_WS_METHODS.dispatchCommand]: DispatchResult,
  [ORCHESTRATION_WS_METHODS.getSnapshot]: OrchestrationGetSnapshotResult,
  [ORCHESTRATION_WS_METHODS.getTurnDiff]: OrchestrationGetTurnDiffResult,
  [ORCHESTRATION_WS_METHODS.getFullThreadDiff]: OrchestrationGetFullThreadDiffResult,
  [ORCHESTRATION_WS_METHODS.replayEvents]: OrchestrationReplayEventsResult,
  [WS_METHODS.projectsSearchEntries]: ProjectSearchEntriesResult,
  [WS_METHODS.projectsReadAgentsFile]: ProjectAgentsFileResult,
  [WS_METHODS.projectsDraftAgentsFile]: ProjectDraftAgentsFileResult,
  [WS_METHODS.projectsListCommandTemplates]: ProjectListCommandTemplatesResult,
  [WS_METHODS.projectsListSourceFiles]: ProjectListSourceFilesResult,
  [WS_METHODS.projectsListSkills]: ProjectListSkillsResult,
  [WS_METHODS.projectsReadFile]: ProjectReadFileResult,
  [WS_METHODS.projectsWriteFile]: ProjectWriteFileResult,
  [WS_METHODS.projectsDeleteFile]: ProjectDeleteFileResult,
  [WS_METHODS.threadsGetShareStatus]: ThreadShareStatusResult,
  [WS_METHODS.threadsCreateShare]: ThreadCreateShareResult,
  [WS_METHODS.threadsGetShare]: ThreadGetShareResult,
  [WS_METHODS.threadsRevokeShare]: ThreadRevokeShareResult,
  [WS_METHODS.threadsImportShare]: ThreadImportShareResult,
  [WS_METHODS.threadsCompact]: ThreadCompactResult,
  [WS_METHODS.threadsUndo]: ThreadUndoResult,
  [WS_METHODS.threadsRedo]: ThreadRedoResult,
  [WS_METHODS.threadsGetRedoStatus]: ThreadRedoStatusResult,
  [WS_METHODS.reviewApprove]: ReviewApproveResult,
  [WS_METHODS.reviewReject]: ReviewRejectResult,
  [WS_METHODS.shellOpenInEditor]: Schema.Void,
  [WS_METHODS.gitPull]: GitPullResult,
  [WS_METHODS.gitStatus]: GitStatusResult,
  [WS_METHODS.gitRunStackedAction]: GitRunStackedActionResult,
  [WS_METHODS.gitListBranches]: GitListBranchesResult,
  [WS_METHODS.gitCreateWorktree]: GitCreateWorktreeResult,
  [WS_METHODS.gitRemoveWorktree]: Schema.Void,
  [WS_METHODS.gitCherryPick]: GitIntegrationResult,
  [WS_METHODS.gitMergeBranch]: GitIntegrationResult,
  [WS_METHODS.gitCreateBranch]: Schema.Void,
  [WS_METHODS.gitCheckout]: Schema.Void,
  [WS_METHODS.gitInit]: Schema.Void,
  [WS_METHODS.gitResolvePullRequest]: GitResolvePullRequestResult,
  [WS_METHODS.gitPreparePullRequestThread]: GitPreparePullRequestThreadResult,
  [WS_METHODS.worktreesCreate]: CreateWorktreeResult,
  [WS_METHODS.worktreesList]: ListWorktreesResult,
  [WS_METHODS.worktreesRemove]: Schema.Void,
  [WS_METHODS.worktreesInfo]: WorktreeInfo,
  [WS_METHODS.terminalOpen]: TerminalSessionSnapshot,
  [WS_METHODS.terminalWrite]: Schema.Void,
  [WS_METHODS.terminalResize]: Schema.Void,
  [WS_METHODS.terminalClear]: Schema.Void,
  [WS_METHODS.terminalRestart]: TerminalSessionSnapshot,
  [WS_METHODS.terminalClose]: Schema.Void,
  [WS_METHODS.serverGetConfig]: ServerConfig,
  [WS_METHODS.serverGetCopilotUsage]: ServerCopilotUsage,
  [WS_METHODS.serverProbeCopilotReasoning]: ServerCopilotReasoningProbe,
  [WS_METHODS.serverGetOpenCodeState]: ServerOpenCodeState,
  [WS_METHODS.serverUpsertKeybinding]: ServerUpsertKeybindingResult,
  [WS_METHODS.serverAddOpenCodeCredential]: ServerOpenCodeCredentialResult,
  [WS_METHODS.serverRemoveOpenCodeCredential]: ServerOpenCodeCredentialResult,

  // Features methods
  [WS_METHODS.featuresCreate]: CreateFeatureResult,
  [WS_METHODS.featuresGet]: GetFeatureResult,
  [WS_METHODS.featuresListByProject]: ListFeaturesByProjectResult,
  [WS_METHODS.featuresUpdate]: UpdateFeatureResult,
  [WS_METHODS.featuresUpdateStage]: UpdateFeatureStageResult,
  [WS_METHODS.featuresDelete]: DeleteFeatureResult,

  // Goals methods
  [WS_METHODS.goalsCreate]: CreateGoalResult,
  [WS_METHODS.goalsList]: ListGoalsByProjectResult,
  [WS_METHODS.goalsUpdate]: UpdateGoalResult,
  [WS_METHODS.goalsGet]: GetGoalResult,
  [WS_METHODS.goalsListByProject]: ListGoalsByProjectResult,
  [WS_METHODS.goalsSetMain]: SetMainGoalResult,
  [WS_METHODS.goalsLinkThread]: LinkThreadToGoalResult,
  [WS_METHODS.goalsUnlinkThread]: UnlinkThreadFromGoalResult,
  [WS_METHODS.goalsUpdateText]: UpdateGoalTextResult,
  [WS_METHODS.goalsChildren]: GetGoalChildrenResult,
  [WS_METHODS.goalsAncestors]: GetGoalAncestorsResult,
  [WS_METHODS.goalsDelete]: DeleteGoalResult,

  // Goal document methods
  [WS_METHODS.documentsList]: ListDocumentsByGoalResult,
  [WS_METHODS.documentsRead]: GoalDocumentResult,
  [WS_METHODS.documentsWrite]: GoalDocumentResult,
  [WS_METHODS.documentsCreate]: GoalDocumentResult,
  [WS_METHODS.documentsUpdate]: GoalDocumentResult,
  [WS_METHODS.documentsDelete]: DeleteGoalDocumentResult,

  // Goal approval methods
  [WS_METHODS.approvalsList]: ListApprovalsByGoalResult,
  [WS_METHODS.approvalsCreate]: ApprovalGateResult,
  [WS_METHODS.approvalsApprove]: ApprovalGateResult,
  [WS_METHODS.approvalsReject]: ApprovalGateResult,
  [WS_METHODS.approvalsIsGoalApproved]: IsGoalApprovedResult,

  // Context methods
  [WS_METHODS.contextCreateNode]: CreateContextNodeResult,
  [WS_METHODS.contextGetNode]: GetContextNodeResult,
  [WS_METHODS.contextListByProject]: ListContextNodesByProjectResult,
  [WS_METHODS.contextListByThread]: ListContextNodesByThreadResult,
  [WS_METHODS.contextCompressNode]: CompressContextNodeResult,
  [WS_METHODS.contextRestoreNode]: RestoreContextNodeResult,
  [WS_METHODS.contextDeleteNode]: DeleteContextNodeResult,
  [WS_METHODS.contextGetBudget]: GetContextBudgetResult,
  [WS_METHODS.memoryCreate]: CreateMemoryResult,
  [WS_METHODS.memorySearch]: SearchMemoryResult,
  [WS_METHODS.memoryListByProject]: ListMemoryByProjectResult,
  [WS_METHODS.memoryDelete]: DeleteMemoryResult,
  [WS_METHODS.coreAgentsList]: CoreAgentListResponse,
  [WS_METHODS.coreAgentsCreate]: CoreAgentMutationResponse,
  [WS_METHODS.coreAgentsUpdate]: CoreAgentMutationResponse,
  [WS_METHODS.coreAgentsDelete]: CoreAgentDeleteResponse,
  [WS_METHODS.coreAgentsSetActive]: CoreAgentSetActiveResponse,
  [WS_METHODS.memoryNotesList]: MemoryNoteListResponse,
  [WS_METHODS.memoryNotesRead]: MemoryNoteResponse,
  [WS_METHODS.memoryNotesWrite]: MemoryNoteResponse,
  [WS_METHODS.memoryNotesDelete]: MemoryNoteDeleteResponse,
  [WS_METHODS.codebaseHealthSummary]: GetCodebaseHealthResult,
  [WS_METHODS.codebaseUpdateHealth]: UpdateCodebaseHealthResult,
  [WS_METHODS.promptsList]: ListPromptsResult,
  [WS_METHODS.promptsCreate]: CreatePromptResult,
  [WS_METHODS.promptsUpdate]: UpdatePromptResult,
  [WS_METHODS.promptsDelete]: DeletePromptResult,
  [WS_METHODS.harnessPresetsList]: ListHarnessPresetsResult,
  [WS_METHODS.harnessActivate]: ActivateHarnessResult,
  [WS_METHODS.harnessDeactivate]: DeactivateHarnessResult,
  [WS_METHODS.harnessGetActive]: Schema.Struct({ preset: Schema.NullOr(HarnessPreset) }),
  [WS_METHODS.featureThreadLink]: Schema.Struct({}),
  [WS_METHODS.featureThreadUnlink]: Schema.Struct({}),
  [WS_METHODS.featureThreadGetLinks]: Schema.Struct({
    links: Schema.Array(
      Schema.Struct({
        featureId: Schema.String,
        threadId: Schema.String,
        createdAt: Schema.String,
      }),
    ),
  }),
  [WS_METHODS.agentOverview]: GetAgentOverviewResult,
  [WS_METHODS.agentSpawnForFeature]: SpawnAgentForFeatureResult,
  [WS_METHODS.agentDetectConflicts]: DetectConflictsResult,
} as const;

export type WsRpcMethod = keyof typeof WsRpcResultSchemaByMethod;

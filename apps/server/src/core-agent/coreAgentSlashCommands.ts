import fs from "node:fs/promises";
import path from "node:path";

import {
  ApprovalGateId,
  GoalDocumentId,
  GoalId,
  type ApprovalGate,
  type ApprovalGateResult,
  type ApprovalGateStatus,
  type CreateApprovalInput,
  type CreateGoalDocumentInput,
  type CreateGoalInput,
  type CreateGoalResult,
  type Goal,
  type GoalDocument,
  type GoalDocumentResult,
  type GoalLevel,
  type GoalStatus,
  type ListApprovalsByGoalResult,
  type ListDocumentsByGoalResult,
  type ListGoalsByProjectResult,
  type ProjectId,
  type ReadGoalDocumentInput,
  type UpdateGoalInput,
  type UpdateGoalResult,
  type CoreAgentMetadata,
  type CoreAgentScope,
} from "@t3tools/contracts";
import { Effect } from "effect";

import type { CoreAgentService } from "./CoreAgentService.ts";
import type { MemoryPalaceServiceShape } from "./MemoryPalaceService.ts";
import {
  readAgentMetadata,
  resolveGlobalAgentMetadataPath,
  resolveProjectAgentMetadataPath,
} from "./agentMetadataStore.ts";
import { CORE_AGENT_PERSONALITY_PRESETS, getPersonalityPreset } from "./personalityPresets.ts";

export type CoreAgentSlashCommand =
  | { readonly kind: "agents" }
  | { readonly kind: "switch"; readonly target: string }
  | { readonly kind: "persona"; readonly value: string }
  | { readonly kind: "init" }
  | { readonly kind: "doctor" }
  | { readonly kind: "compact" }
  | { readonly kind: "reflect" }
  | { readonly kind: "goalsList" }
  | {
      readonly kind: "goalsCreate";
      readonly text: string;
      readonly parentId?: GoalId;
      readonly level?: GoalLevel;
      readonly ownerAgentId?: string;
    }
  | { readonly kind: "goalsUpdateStatus"; readonly goalId: GoalId; readonly status: GoalStatus }
  | { readonly kind: "documentsList"; readonly goalId: GoalId }
  | {
      readonly kind: "documentsCreate";
      readonly goalId: GoalId;
      readonly title: string;
      readonly content: string;
    }
  | { readonly kind: "documentsRead"; readonly goalId: GoalId; readonly documentId: GoalDocumentId }
  | { readonly kind: "approvalsShow"; readonly goalId: GoalId }
  | { readonly kind: "approvalsCreate"; readonly goalId: GoalId; readonly reason?: string }
  | {
      readonly kind: "approvalsApprove";
      readonly goalId: GoalId;
      readonly approvalId: ApprovalGateId;
      readonly reason?: string;
    }
  | {
      readonly kind: "approvalsReject";
      readonly goalId: GoalId;
      readonly approvalId: ApprovalGateId;
      readonly reason: string;
    };

export type CoreAgentSlashCommandResult = {
  readonly handled: true;
  readonly response: string;
};

export type CoreAgentConversationMessage = {
  readonly role: string;
  readonly text?: string;
  readonly content?: string;
};

export type ConversationSummarizer = {
  readonly summarizeConversation: (input: {
    readonly messages: ReadonlyArray<{ role: string; content: string }>;
    readonly maxSummaryTokens: number;
  }) => Effect.Effect<{ readonly summary: string; readonly tokensSaved: number }>;
};

type GoalsSlashService = {
  readonly createGoal: (input: CreateGoalInput) => Effect.Effect<CreateGoalResult, Error, never>;
  readonly getGoal: (input: {
    readonly id: GoalId;
  }) => Effect.Effect<{ readonly goal: Goal }, Error, never>;
  readonly listGoalsByProject: (input: {
    readonly projectId: ProjectId;
  }) => Effect.Effect<ListGoalsByProjectResult, Error, never>;
  readonly updateGoal: (input: UpdateGoalInput) => Effect.Effect<UpdateGoalResult, Error, never>;
};

type DocumentsSlashService = {
  readonly createDocument: (
    input: CreateGoalDocumentInput,
  ) => Effect.Effect<GoalDocumentResult, Error, never>;
  readonly readDocument: (
    input: ReadGoalDocumentInput,
  ) => Effect.Effect<GoalDocumentResult, Error, never>;
  readonly listDocumentsByGoal: (input: {
    readonly goalId: GoalId;
  }) => Effect.Effect<ListDocumentsByGoalResult, Error, never>;
};

type ApprovalsSlashService = {
  readonly createApproval: (
    input: CreateApprovalInput,
  ) => Effect.Effect<ApprovalGateResult, Error, never>;
  readonly approve: (input: {
    readonly goalId: GoalId;
    readonly approvalId: ApprovalGateId;
    readonly reviewedBy: string;
    readonly reason?: string;
  }) => Effect.Effect<ApprovalGateResult, Error, never>;
  readonly reject: (input: {
    readonly goalId: GoalId;
    readonly approvalId: ApprovalGateId;
    readonly reviewedBy: string;
    readonly reason?: string;
  }) => Effect.Effect<ApprovalGateResult, Error, never>;
  readonly listApprovalsByGoal: (input: {
    readonly goalId: GoalId;
  }) => Effect.Effect<ListApprovalsByGoalResult, Error, never>;
};

export function parseCoreAgentSlashCommand(text: string): CoreAgentSlashCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const match = /^\/([A-Za-z][A-Za-z0-9_-]*)(?:\s+([\s\S]*))?$/.exec(trimmed);
  if (!match) return null;

  const command = (match[1] ?? "").toLowerCase();
  const rawRest = (match[2] ?? "").trim();
  const rest = unquote(rawRest);
  if (command === "agents" && rest.length === 0) {
    return { kind: "agents" };
  }
  if (command === "switch" && rest.length > 0) {
    return { kind: "switch", target: rest };
  }
  if (command === "persona" && rest.length > 0) {
    return { kind: "persona", value: rest };
  }
  if (command === "init" && rest.length === 0) {
    return { kind: "init" };
  }
  if (command === "doctor" && rest.length === 0) {
    return { kind: "doctor" };
  }
  if (command === "compact" && rest.length === 0) {
    return { kind: "compact" };
  }
  if (command === "reflect" && rest.length === 0) {
    return { kind: "reflect" };
  }
  if (command === "goals") {
    return parseGoalsSlashCommand(rawRest);
  }
  if (command === "doc") {
    return parseDocumentSlashCommand(rawRest);
  }
  if (command === "approve") {
    return parseApprovalSlashCommand(rawRest);
  }
  return null;
}

export async function executeCoreAgentSlashCommand(input: {
  readonly service: Pick<
    CoreAgentService,
    "listAgents" | "resolveActiveAgent" | "setActiveAgent" | "updateAgent"
  >;
  readonly memory?: Pick<MemoryPalaceServiceShape, "list" | "read" | "write">;
  readonly organizing?: {
    readonly projectId?: ProjectId;
    readonly actorId?: string;
    readonly goals?: GoalsSlashService;
    readonly documents?: DocumentsSlashService;
    readonly approvals?: ApprovalsSlashService;
  };
  readonly conversationMessages?: ReadonlyArray<CoreAgentConversationMessage>;
  readonly summarizer?: ConversationSummarizer;
  readonly now?: () => string;
  readonly scope: CoreAgentScope;
  readonly stateDir?: string;
  readonly text: string;
}): Promise<CoreAgentSlashCommandResult | null> {
  const command = parseCoreAgentSlashCommand(input.text);
  if (!command) return null;

  if (command.kind === "agents") {
    const active = await input.service.resolveActiveAgent({ scope: input.scope });
    const list = await input.service.listAgents({ scope: input.scope });
    return {
      handled: true,
      response: formatAgentList(list.agents, active.activeAgentId),
    };
  }

  if (command.kind === "switch") {
    const list = await input.service.listAgents({ scope: input.scope });
    const match = findAgentByNameOrId(list.agents, command.target);
    if (!match) {
      return {
        handled: true,
        response: `No agent matched "${command.target}". Run /agents to see available agents.`,
      };
    }
    const active = await input.service.setActiveAgent({
      scope: input.scope,
      agentId: match.id,
    });
    return {
      handled: true,
      response: `Switched active agent to ${active.agent.name} (${active.activeAgentId}).`,
    };
  }

  if (command.kind === "init") {
    return {
      handled: true,
      response: await initializeProjectMemory({
        service: input.service,
        memory: input.memory,
        scope: input.scope,
      }),
    };
  }

  if (command.kind === "doctor") {
    return {
      handled: true,
      response: await diagnoseMemory({
        service: input.service,
        memory: input.memory,
        scope: input.scope,
        stateDir: input.stateDir,
      }),
    };
  }

  if (command.kind === "compact") {
    return {
      handled: true,
      response: await compactConversationIntoMemory({
        service: input.service,
        memory: input.memory,
        scope: input.scope,
        conversationMessages: input.conversationMessages,
        summarizer: input.summarizer,
        now: input.now,
      }),
    };
  }

  if (command.kind === "reflect") {
    return {
      handled: true,
      response: await reflectOnMemory({
        service: input.service,
        memory: input.memory,
        scope: input.scope,
      }),
    };
  }

  if (command.kind === "goalsList") {
    return {
      handled: true,
      response: await listGoalsForCurrentProject(input.organizing),
    };
  }

  if (command.kind === "goalsCreate") {
    return {
      handled: true,
      response: await createGoalForCurrentProject(input.organizing, command),
    };
  }

  if (command.kind === "goalsUpdateStatus") {
    return {
      handled: true,
      response: await updateGoalStatus(input.organizing, command),
    };
  }

  if (command.kind === "documentsList") {
    return {
      handled: true,
      response: await listDocumentsForGoal(input.organizing, command.goalId),
    };
  }

  if (command.kind === "documentsCreate") {
    return {
      handled: true,
      response: await createDocumentForGoal(input.organizing, command),
    };
  }

  if (command.kind === "documentsRead") {
    return {
      handled: true,
      response: await readDocumentForGoal(input.organizing, command),
    };
  }

  if (command.kind === "approvalsShow") {
    return {
      handled: true,
      response: await showApprovalStatus(input.organizing, command.goalId),
    };
  }

  if (command.kind === "approvalsCreate") {
    return {
      handled: true,
      response: await createApprovalGate(input.organizing, command),
    };
  }

  if (command.kind === "approvalsApprove") {
    return {
      handled: true,
      response: await reviewApprovalGate(input.organizing, command, "approved"),
    };
  }

  if (command.kind === "approvalsReject") {
    return {
      handled: true,
      response: await reviewApprovalGate(input.organizing, command, "rejected"),
    };
  }

  const active = await input.service.resolveActiveAgent({ scope: input.scope });
  const preset = findPreset(command.value);
  if (preset) {
    await input.service.updateAgent({
      scope: input.scope,
      agentId: active.activeAgentId,
      personality: {
        kind: "preset",
        presetId: preset.id,
        instructions: preset.defaultInstructions,
      },
    });
    return {
      handled: true,
      response: `Updated ${active.agent.name} personality to ${preset.id}.`,
    };
  }

  await input.service.updateAgent({
    scope: input.scope,
    agentId: active.activeAgentId,
    personality: {
      kind: "custom",
      instructions: command.value,
    },
  });
  return {
    handled: true,
    response: `Updated ${active.agent.name} personality.`,
  };
}

function parseGoalsSlashCommand(rawRest: string): CoreAgentSlashCommand | null {
  const firstLine = firstCommandLine(rawRest);
  if (firstLine.length === 0) return { kind: "goalsList" };
  const tokens = tokenizeCommandLine(firstLine);
  const subcommand = tokens[0]?.toLowerCase();
  if (subcommand === "create") {
    const parsed = parseGoalCreateTokens(tokens.slice(1));
    if (!parsed || parsed.text.trim().length === 0) return null;
    return {
      kind: "goalsCreate",
      text: parsed.text,
      ...(parsed.parentId ? { parentId: GoalId.makeUnsafe(parsed.parentId) } : {}),
      ...(parsed.level ? { level: parsed.level } : {}),
      ...(parsed.ownerAgentId ? { ownerAgentId: parsed.ownerAgentId } : {}),
    };
  }
  if (subcommand === "update") {
    const goalId = tokens[1];
    const statusIndex = tokens.findIndex((token) => token === "--status");
    const status = statusIndex >= 0 ? tokens[statusIndex + 1] : undefined;
    if (!goalId || !isGoalStatus(status)) return null;
    return {
      kind: "goalsUpdateStatus",
      goalId: GoalId.makeUnsafe(goalId),
      status,
    };
  }
  return null;
}

function parseDocumentSlashCommand(rawRest: string): CoreAgentSlashCommand | null {
  const [firstLine = "", ...bodyLines] = rawRest.split(/\r?\n/);
  const tokens = tokenizeCommandLine(firstLine.trim());
  const subcommand = tokens[0]?.toLowerCase();
  if (!subcommand) return null;
  if (subcommand === "create") {
    const goalId = tokens[1];
    const title = tokens.slice(2).join(" ").trim();
    if (!goalId || title.length === 0) return null;
    return {
      kind: "documentsCreate",
      goalId: GoalId.makeUnsafe(goalId),
      title,
      content: bodyLines.join("\n").trim(),
    };
  }
  if (subcommand === "read") {
    const goalId = tokens[1];
    const documentId = tokens[2];
    if (!goalId || !documentId) return null;
    return {
      kind: "documentsRead",
      goalId: GoalId.makeUnsafe(goalId),
      documentId: GoalDocumentId.makeUnsafe(documentId),
    };
  }
  const onlyToken = tokens[0];
  if (tokens.length === 1 && onlyToken) {
    return { kind: "documentsList", goalId: GoalId.makeUnsafe(onlyToken) };
  }
  return null;
}

function parseApprovalSlashCommand(rawRest: string): CoreAgentSlashCommand | null {
  const tokens = tokenizeCommandLine(firstCommandLine(rawRest));
  const subcommand = tokens[0]?.toLowerCase();
  if (!subcommand) return null;
  if (subcommand === "create") {
    const goalId = tokens[1];
    const reason = tokens.slice(2).join(" ").trim();
    if (!goalId) return null;
    return {
      kind: "approvalsCreate",
      goalId: GoalId.makeUnsafe(goalId),
      ...(reason.length > 0 ? { reason } : {}),
    };
  }
  if (subcommand === "approve") {
    const goalId = tokens[1];
    const approvalId = tokens[2];
    const reason = tokens.slice(3).join(" ").trim();
    if (!goalId || !approvalId) return null;
    return {
      kind: "approvalsApprove",
      goalId: GoalId.makeUnsafe(goalId),
      approvalId: ApprovalGateId.makeUnsafe(approvalId),
      ...(reason.length > 0 ? { reason } : {}),
    };
  }
  if (subcommand === "reject") {
    const goalId = tokens[1];
    const approvalId = tokens[2];
    const reason = tokens.slice(3).join(" ").trim();
    if (!goalId || !approvalId || reason.length === 0) return null;
    return {
      kind: "approvalsReject",
      goalId: GoalId.makeUnsafe(goalId),
      approvalId: ApprovalGateId.makeUnsafe(approvalId),
      reason,
    };
  }
  const onlyToken = tokens[0];
  if (tokens.length === 1 && onlyToken) {
    return { kind: "approvalsShow", goalId: GoalId.makeUnsafe(onlyToken) };
  }
  return null;
}

function parseGoalCreateTokens(
  tokens: ReadonlyArray<string>,
): { text: string; parentId?: string; level?: GoalLevel; ownerAgentId?: string } | null {
  const textTokens: string[] = [];
  let parentId: string | undefined;
  let level: GoalLevel | undefined;
  let ownerAgentId: string | undefined;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--parent") {
      parentId = tokens[index + 1];
      index += 1;
      continue;
    }
    if (token === "--level") {
      const value = tokens[index + 1];
      if (!isGoalLevel(value)) return null;
      level = value;
      index += 1;
      continue;
    }
    if (token === "--agent") {
      ownerAgentId = tokens[index + 1];
      index += 1;
      continue;
    }
    if (token) textTokens.push(token);
  }
  return {
    text: textTokens.join(" ").trim(),
    ...(parentId ? { parentId } : {}),
    ...(level ? { level } : {}),
    ...(ownerAgentId ? { ownerAgentId } : {}),
  };
}

function firstCommandLine(value: string): string {
  return (value.split(/\r?\n/)[0] ?? "").trim();
}

function tokenizeCommandLine(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (const char of value) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === `"` || char === `'`) {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

function isGoalStatus(value: string | undefined): value is GoalStatus {
  return value === "planned" || value === "active" || value === "achieved" || value === "cancelled";
}

function isGoalLevel(value: string | undefined): value is GoalLevel {
  return value === "company" || value === "team" || value === "agent" || value === "task";
}

function unquote(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function formatAgentList(agents: ReadonlyArray<CoreAgentMetadata>, activeAgentId: string): string {
  const active = agents.find((agent) => agent.id === activeAgentId);
  const lines = [
    `Active agent: ${active ? `${active.name} (${active.id})` : activeAgentId}`,
    "",
    "Agents:",
  ];
  for (const agent of agents) {
    const marker = agent.id === activeAgentId ? "*" : "-";
    lines.push(`${marker} ${agent.name} (${agent.id})`);
  }
  return lines.join("\n");
}

function findAgentByNameOrId(
  agents: ReadonlyArray<CoreAgentMetadata>,
  target: string,
): CoreAgentMetadata | undefined {
  const normalized = target.trim().toLowerCase();
  return agents.find(
    (agent) => agent.id.toLowerCase() === normalized || agent.name.toLowerCase() === normalized,
  );
}

async function listGoalsForCurrentProject(
  organizing: { readonly projectId?: ProjectId; readonly goals?: GoalsSlashService } | undefined,
): Promise<string> {
  const validation = requireProjectGoals(organizing, "/goals");
  if (typeof validation === "string") return validation;
  const { goals } = await Effect.runPromise(
    validation.goals.listGoalsByProject({ projectId: validation.projectId }),
  );
  if (goals.length === 0) {
    return "No goals found for this project.";
  }
  return formatGoalTree(goals);
}

async function createGoalForCurrentProject(
  organizing: { readonly projectId?: ProjectId; readonly goals?: GoalsSlashService } | undefined,
  command: Extract<CoreAgentSlashCommand, { readonly kind: "goalsCreate" }>,
): Promise<string> {
  const validation = requireProjectGoals(organizing, "/goals create");
  if (typeof validation === "string") return validation;
  const { goal } = await Effect.runPromise(
    validation.goals.createGoal({
      projectId: validation.projectId,
      text: command.text,
      isMain: false,
      status: "planned",
      ...(command.parentId ? { parentId: command.parentId } : {}),
      ...(command.level ? { level: command.level } : {}),
      ...(command.ownerAgentId ? { ownerAgentId: command.ownerAgentId } : {}),
    }),
  );
  return [
    "Created goal:",
    `${statusIcon(goal.status)} [${goal.status}] [${goal.level}] ${goal.text}`,
    `ID: ${goal.id}`,
    `Project: ${goal.projectId}`,
    ...(goal.parentId ? [`Parent: ${goal.parentId}`] : []),
    ...(goal.ownerAgentId ? [`Agent: ${goal.ownerAgentId}`] : []),
  ].join("\n");
}

async function updateGoalStatus(
  organizing: { readonly goals?: GoalsSlashService } | undefined,
  command: Extract<CoreAgentSlashCommand, { readonly kind: "goalsUpdateStatus" }>,
): Promise<string> {
  if (!organizing?.goals) return "Goal commands are unavailable in this session.";
  const current = (await Effect.runPromise(organizing.goals.getGoal({ id: command.goalId }))).goal;
  if (!isAllowedGoalStatusTransition(current.status, command.status)) {
    return `Cannot move goal ${current.id} from ${current.status} to ${command.status}. Allowed transitions are planned -> active -> achieved, or any status -> cancelled.`;
  }
  const { goal } = await Effect.runPromise(
    organizing.goals.updateGoal({ id: command.goalId, status: command.status }),
  );
  return [
    "Updated goal status:",
    `${statusIcon(goal.status)} [${goal.status}] [${goal.level}] ${goal.text}`,
    `ID: ${goal.id}`,
  ].join("\n");
}

async function listDocumentsForGoal(
  organizing: { readonly documents?: DocumentsSlashService } | undefined,
  goalId: GoalId,
): Promise<string> {
  if (!organizing?.documents) return "Document commands are unavailable in this session.";
  const { documents } = await Effect.runPromise(
    organizing.documents.listDocumentsByGoal({ goalId }),
  );
  if (documents.length === 0) {
    return `No documents found for goal ${goalId}.`;
  }
  return [
    `Documents for goal ${goalId}:`,
    ...documents.map((document) => `- v${document.version} ${document.title} (${document.id})`),
  ].join("\n");
}

async function createDocumentForGoal(
  organizing: { readonly documents?: DocumentsSlashService } | undefined,
  command: Extract<CoreAgentSlashCommand, { readonly kind: "documentsCreate" }>,
): Promise<string> {
  if (!organizing?.documents) return "Document commands are unavailable in this session.";
  const { document } = await Effect.runPromise(
    organizing.documents.createDocument({
      goalId: command.goalId,
      title: command.title,
      content: command.content,
    }),
  );
  return [
    "Created document:",
    `${document.title} (${document.id})`,
    `Goal: ${document.goalId}`,
    `Version: v${document.version}`,
  ].join("\n");
}

async function readDocumentForGoal(
  organizing: { readonly documents?: DocumentsSlashService } | undefined,
  command: Extract<CoreAgentSlashCommand, { readonly kind: "documentsRead" }>,
): Promise<string> {
  if (!organizing?.documents) return "Document commands are unavailable in this session.";
  const { document } = await Effect.runPromise(
    organizing.documents.readDocument({
      goalId: command.goalId,
      documentId: command.documentId,
    }),
  );
  return formatDocument(document);
}

async function showApprovalStatus(
  organizing: { readonly approvals?: ApprovalsSlashService } | undefined,
  goalId: GoalId,
): Promise<string> {
  if (!organizing?.approvals) return "Approval commands are unavailable in this session.";
  const { approvals } = await Effect.runPromise(
    organizing.approvals.listApprovalsByGoal({ goalId }),
  );
  return formatApprovalStatus(goalId, approvals);
}

async function createApprovalGate(
  organizing: { readonly approvals?: ApprovalsSlashService; readonly actorId?: string } | undefined,
  command: Extract<CoreAgentSlashCommand, { readonly kind: "approvalsCreate" }>,
): Promise<string> {
  if (!organizing?.approvals) return "Approval commands are unavailable in this session.";
  const { approval } = await Effect.runPromise(
    organizing.approvals.createApproval({
      goalId: command.goalId,
      requestedBy: organizing.actorId ?? "rowl",
      ...(command.reason ? { reason: command.reason } : {}),
    }),
  );
  return [
    "Created approval gate:",
    `${approvalStatusIcon(approval.status)} [${approval.status}] ${approval.id}`,
    `Goal: ${approval.goalId}`,
    `Requested by: ${approval.requestedBy}`,
    ...(approval.reason ? [`Reason: ${approval.reason}`] : []),
  ].join("\n");
}

async function reviewApprovalGate(
  organizing: { readonly approvals?: ApprovalsSlashService; readonly actorId?: string } | undefined,
  command:
    | Extract<CoreAgentSlashCommand, { readonly kind: "approvalsApprove" }>
    | Extract<CoreAgentSlashCommand, { readonly kind: "approvalsReject" }>,
  status: "approved" | "rejected",
): Promise<string> {
  if (!organizing?.approvals) return "Approval commands are unavailable in this session.";
  const reviewedBy = organizing.actorId ?? "rowl";
  const result =
    status === "approved"
      ? await Effect.runPromise(
          organizing.approvals.approve({
            goalId: command.goalId,
            approvalId: command.approvalId,
            reviewedBy,
            ...(command.reason ? { reason: command.reason } : {}),
          }),
        )
      : await Effect.runPromise(
          organizing.approvals.reject({
            goalId: command.goalId,
            approvalId: command.approvalId,
            reviewedBy,
            ...(command.reason ? { reason: command.reason } : {}),
          }),
        );
  const approval = result.approval;
  return [
    status === "approved" ? "Approved gate:" : "Rejected gate:",
    `${approvalStatusIcon(approval.status)} [${approval.status}] ${approval.id}`,
    `Goal: ${approval.goalId}`,
    `Reviewed by: ${approval.reviewedBy ?? reviewedBy}`,
    ...(approval.reason ? [`Reason: ${approval.reason}`] : []),
  ].join("\n");
}

function requireProjectGoals(
  organizing: { readonly projectId?: ProjectId; readonly goals?: GoalsSlashService } | undefined,
  commandName: string,
): { readonly projectId: ProjectId; readonly goals: GoalsSlashService } | string {
  if (!organizing?.goals) return "Goal commands are unavailable in this session.";
  if (!organizing.projectId) {
    return `${commandName} needs an active project workspace. Open a project-backed thread, then run it again.`;
  }
  return { projectId: organizing.projectId, goals: organizing.goals };
}

function isAllowedGoalStatusTransition(current: GoalStatus, next: GoalStatus): boolean {
  if (current === next) return true;
  if (next === "cancelled") return true;
  if (current === "planned" && next === "active") return true;
  if (current === "active" && next === "achieved") return true;
  return false;
}

function formatGoalTree(goals: ReadonlyArray<Goal>): string {
  const sorted = goals.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
  const byId = new Map(sorted.map((goal) => [goal.id, goal]));
  const childrenByParent = new Map<string, Goal[]>();
  const roots: Goal[] = [];
  for (const goal of sorted) {
    if (goal.parentId && byId.has(goal.parentId)) {
      const children = childrenByParent.get(goal.parentId) ?? [];
      children.push(goal);
      childrenByParent.set(goal.parentId, children);
    } else {
      roots.push(goal);
    }
  }

  const lines = ["Goals:"];
  const visit = (goal: Goal, depth: number) => {
    lines.push(`${"  ".repeat(depth)}- ${formatGoalLine(goal)}`);
    for (const child of childrenByParent.get(goal.id) ?? []) {
      visit(child, depth + 1);
    }
  };
  for (const root of roots) {
    visit(root, 0);
  }
  return lines.join("\n");
}

function formatGoalLine(goal: Goal): string {
  const details = [
    `${statusIcon(goal.status)} [${goal.status}]`,
    `[${goal.level}]`,
    goal.text,
    `(${goal.id})`,
  ];
  if (goal.ownerAgentId) details.push(`agent:${goal.ownerAgentId}`);
  return details.join(" ");
}

function statusIcon(status: GoalStatus): string {
  switch (status) {
    case "planned":
      return "○";
    case "active":
      return "▶";
    case "achieved":
      return "✓";
    case "cancelled":
      return "×";
  }
}

function formatDocument(document: GoalDocument): string {
  return [
    `${document.title} (${document.id})`,
    `Goal: ${document.goalId}`,
    `Version: v${document.version}`,
    `Created: ${document.createdAt}`,
    `Updated: ${document.updatedAt}`,
    "",
    document.content,
  ].join("\n");
}

function formatApprovalStatus(goalId: GoalId, approvals: ReadonlyArray<ApprovalGate>): string {
  const aggregate = approvalAggregate(approvals);
  const lines = [
    `Approval status for goal ${goalId}: ${aggregate}`,
    "",
    approvals.length === 0 ? "No approval gates." : "Approval gates:",
  ];
  for (const approval of approvals) {
    lines.push(
      `- ${approvalStatusIcon(approval.status)} [${approval.status}] ${approval.id}${
        approval.reason ? ` - ${approval.reason}` : ""
      }`,
    );
  }
  return lines.join("\n");
}

function approvalAggregate(
  approvals: ReadonlyArray<ApprovalGate>,
): "approved" | "pending" | "rejected" {
  if (approvals.some((approval) => approval.status === "rejected")) return "rejected";
  if (approvals.length > 0 && approvals.every((approval) => approval.status === "approved")) {
    return "approved";
  }
  return "pending";
}

function approvalStatusIcon(status: ApprovalGateStatus): string {
  switch (status) {
    case "pending":
      return "○";
    case "approved":
      return "✓";
    case "rejected":
      return "×";
  }
}

type WorkspaceContext = {
  readonly packageName?: string;
  readonly packageDescription?: string;
  readonly packageManager?: string;
  readonly scripts: ReadonlyArray<string>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  readonly readmePath?: string;
  readonly readmeExcerpt?: string;
  readonly gitBranch?: string;
  readonly gitRemote?: string;
  readonly rowlFiles: ReadonlyArray<string>;
};

async function initializeProjectMemory(input: {
  readonly service: Pick<CoreAgentService, "resolveActiveAgent">;
  readonly memory: Pick<MemoryPalaceServiceShape, "write"> | undefined;
  readonly scope: CoreAgentScope;
}): Promise<string> {
  if (input.scope.type !== "project") {
    return "/init needs an active project workspace. Open a project-backed thread, then run /init again.";
  }
  if (!input.memory) {
    return "/init cannot seed memory because the Memory Palace service is unavailable.";
  }

  const active = await input.service.resolveActiveAgent({ scope: input.scope });
  const context = await inspectWorkspace(input.scope.projectRoot);
  const notes = [
    {
      filename: "project-overview",
      title: "Project overview",
      tags: ["init", "overview"],
      content: formatProjectOverview(context),
    },
    {
      filename: "tech-stack",
      title: "Tech stack",
      tags: ["init", "tech-stack"],
      content: formatTechStack(context),
    },
    {
      filename: "conventions",
      title: "Conventions",
      tags: ["init", "conventions"],
      content: "# Conventions\n",
    },
  ] as const;

  for (const note of notes) {
    await Effect.runPromise(
      input.memory.write({
        scope: input.scope,
        agentId: active.activeAgentId,
        ...note,
      }),
    );
  }

  const details = [
    `Seeded memory for ${active.agent.name} (${active.activeAgentId}).`,
    "",
    "Notes seeded:",
    ...notes.map((note) => `- ${note.filename} - ${note.title}`),
  ];
  if (context.rowlFiles.length > 0) {
    details.push("", `Existing .rowl files noticed: ${context.rowlFiles.join(", ")}`);
  }
  return details.join("\n");
}

async function diagnoseMemory(input: {
  readonly service: Pick<CoreAgentService, "listAgents" | "resolveActiveAgent">;
  readonly memory: Pick<MemoryPalaceServiceShape, "list" | "read"> | undefined;
  readonly scope: CoreAgentScope;
  readonly stateDir: string | undefined;
}): Promise<string> {
  const active = await input.service.resolveActiveAgent({ scope: input.scope });
  if (!input.memory) {
    return "Memory doctor could not run because the Memory Palace service is unavailable.";
  }

  const list = await Effect.runPromise(
    input.memory.list({ scope: input.scope, agentId: active.activeAgentId }),
  );
  const notes = await Promise.all(
    list.notes.map((note) =>
      Effect.runPromise(
        input.memory!.read({
          scope: input.scope,
          agentId: active.activeAgentId,
          filename: note.filename,
        }),
      ).catch(() => null),
    ),
  );
  const readableNotes = notes.filter((note): note is NonNullable<typeof note> => note !== null);
  const emptyNotes = readableNotes
    .filter((note) => isEffectivelyEmptyNote(note.content))
    .map((note) => note.filename);
  const lastUpdated = readableNotes
    .map((note) => note.updated)
    .toSorted()
    .at(-1);
  const metadataFindings = await inspectAgentMetadataConsistency({
    service: input.service,
    scope: input.scope,
    stateDir: input.stateDir,
    agentId: active.activeAgentId,
  });

  const findings: string[] = [];
  const fixes: string[] = [];
  if (list.notes.length === 0) {
    findings.push("No memory notes exist for the active agent in this scope.");
    fixes.push("Run /init to seed starter memories.");
  } else {
    findings.push(`${list.notes.length} memory note${list.notes.length === 1 ? "" : "s"} found.`);
  }
  if (lastUpdated) {
    findings.push(`Last updated: ${lastUpdated}.`);
  } else {
    findings.push("Last updated: unavailable.");
  }
  if (emptyNotes.length > 0) {
    findings.push(`Empty notes: ${emptyNotes.join(", ")}.`);
    fixes.push("Fill or delete empty notes from the Memory panel.");
  } else if (list.notes.length > 0) {
    findings.push("No empty notes detected.");
  }
  findings.push(...metadataFindings.findings);
  fixes.push(...metadataFindings.fixes);
  if (fixes.length === 0) {
    fixes.push("No fixes suggested.");
  }

  return [
    `Memory doctor for ${active.agent.name} (${active.activeAgentId})`,
    "",
    "Findings:",
    ...findings.map((finding) => `- ${finding}`),
    "",
    "Suggested fixes:",
    ...dedupe(fixes).map((fix) => `- ${fix}`),
  ].join("\n");
}

async function compactConversationIntoMemory(input: {
  readonly service: Pick<CoreAgentService, "resolveActiveAgent">;
  readonly memory: Pick<MemoryPalaceServiceShape, "write"> | undefined;
  readonly scope: CoreAgentScope;
  readonly conversationMessages: ReadonlyArray<CoreAgentConversationMessage> | undefined;
  readonly summarizer: ConversationSummarizer | undefined;
  readonly now: (() => string) | undefined;
}): Promise<string> {
  if (!input.memory) {
    return "/compact cannot save a summary because the Memory Palace service is unavailable.";
  }

  const active = await input.service.resolveActiveAgent({ scope: input.scope });
  const compactedAt = input.now?.() ?? new Date().toISOString();
  const messages = normalizeConversationMessages(input.conversationMessages);
  let summaryResult = {
    summary: summarizeConversationHeuristically(messages),
    tokensSaved: 0,
  };
  if (input.summarizer && messages.length > 0) {
    try {
      summaryResult = await Effect.runPromise(
        input.summarizer.summarizeConversation({
          messages,
          maxSummaryTokens: 700,
        }),
      );
    } catch {
      // Keep /compact useful even if a future summarizer implementation fails.
    }
  }

  const filename = `conversation-summary-${timestampSlug(compactedAt)}`;
  const content = [
    `# Conversation summary`,
    "",
    `- Agent: ${active.agent.name} (${active.activeAgentId})`,
    `- Compacted at: ${compactedAt}`,
    `- Messages summarized: ${messages.length}`,
    summaryResult.tokensSaved > 0 ? `- Estimated tokens saved: ${summaryResult.tokensSaved}` : null,
    "",
    "## Summary",
    "",
    summaryResult.summary.trim() || "No prior conversation messages were available to compact.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  await Effect.runPromise(
    input.memory.write({
      scope: input.scope,
      agentId: active.activeAgentId,
      filename,
      title: "Conversation summary",
      tags: ["compacted", "conversation-summary"],
      content,
    }),
  );

  return `Compacted conversation into memory note: ${filename}`;
}

async function reflectOnMemory(input: {
  readonly service: Pick<CoreAgentService, "resolveActiveAgent">;
  readonly memory: Pick<MemoryPalaceServiceShape, "list" | "read"> | undefined;
  readonly scope: CoreAgentScope;
}): Promise<string> {
  const active = await input.service.resolveActiveAgent({ scope: input.scope });
  if (!input.memory) {
    return "Reflection could not run because the Memory Palace service is unavailable.";
  }

  const list = await Effect.runPromise(
    input.memory.list({ scope: input.scope, agentId: active.activeAgentId }),
  );
  const notes = (
    await Promise.all(
      list.notes.map((note) =>
        Effect.runPromise(
          input.memory!.read({
            scope: input.scope,
            agentId: active.activeAgentId,
            filename: note.filename,
          }),
        ).catch(() => null),
      ),
    )
  ).filter((note): note is NonNullable<typeof note> => note !== null);

  const tagCounts = countTags(notes.flatMap((note) => note.tags));
  const emptyNotes = notes
    .filter((note) => isEffectivelyEmptyNote(note.content))
    .map((note) => note.filename);
  const duplicateTitles = duplicateValues(notes.map((note) => note.title.toLowerCase()));
  const compactedNotes = notes.filter((note) => note.tags.includes("conversation-summary"));
  const starterTags = new Set(notes.flatMap((note) => note.tags));
  const missingStarterTags = ["overview", "tech-stack", "conventions"].filter(
    (tag) => !starterTags.has(tag),
  );

  const patterns: string[] =
    notes.length === 0
      ? ["No memory notes found for this agent and scope."]
      : [
          `${notes.length} memory note${notes.length === 1 ? "" : "s"} available.`,
          tagCounts.length > 0
            ? `Most common tags: ${tagCounts
                .slice(0, 5)
                .map(([tag, count]) => `${tag} (${count})`)
                .join(", ")}.`
            : "No tags are used yet.",
          compactedNotes.length > 0
            ? `${compactedNotes.length} compacted conversation summar${compactedNotes.length === 1 ? "y" : "ies"} found.`
            : "No compacted conversation summaries found.",
        ];
  const gaps: string[] = [];
  if (missingStarterTags.length > 0) {
    gaps.push(`Starter memory coverage is missing: ${missingStarterTags.join(", ")}.`);
  }
  if (emptyNotes.length > 0) {
    gaps.push(`Empty or placeholder notes: ${emptyNotes.join(", ")}.`);
  }
  if (notes.length === 0) {
    gaps.push("Run /init or create notes before relying on memory context.");
  }
  if (gaps.length === 0) {
    gaps.push("No obvious coverage gaps detected by heuristic scan.");
  }

  const contradictions: string[] = [];
  if (duplicateTitles.length > 0) {
    contradictions.push(
      `Duplicate note titles may need consolidation: ${duplicateTitles.join(", ")}.`,
    );
  }
  const contradictionHints = notes
    .filter((note) =>
      /\b(conflict|contradict|instead of|no longer|deprecated|obsolete)\b/i.test(note.content),
    )
    .map((note) => note.filename);
  if (contradictionHints.length > 0) {
    contradictions.push(
      `Notes with possible stale or contradictory language: ${contradictionHints.join(", ")}.`,
    );
  }
  if (contradictions.length === 0) {
    contradictions.push("No obvious contradictions detected by heuristic scan.");
  }

  const suggestions: string[] = [];
  if (notes.length === 0) {
    suggestions.push(
      "Seed memory with /init, then add project-specific conventions as they emerge.",
    );
  }
  if (missingStarterTags.length > 0) {
    suggestions.push("Run /init or add overview, tech-stack, and conventions notes manually.");
  }
  if (compactedNotes.length > 3) {
    suggestions.push("Consolidate older conversation-summary notes into durable project facts.");
  } else {
    suggestions.push(
      "Use /compact after long threads to preserve decisions before context trimming.",
    );
  }
  if (emptyNotes.length > 0) {
    suggestions.push("Fill or delete empty notes from the Memory panel.");
  }

  return [
    `Memory reflection for ${active.agent.name} (${active.activeAgentId})`,
    "",
    "Patterns:",
    ...patterns.map((pattern) => `- ${pattern}`),
    "",
    "Gaps:",
    ...dedupe(gaps).map((gap) => `- ${gap}`),
    "",
    "Contradictions:",
    ...dedupe(contradictions).map((contradiction) => `- ${contradiction}`),
    "",
    "Suggestions:",
    ...dedupe(suggestions).map((suggestion) => `- ${suggestion}`),
  ].join("\n");
}

async function inspectWorkspace(projectRoot: string): Promise<WorkspaceContext> {
  const [packageJson, readme, git, rowlFiles] = await Promise.all([
    readPackageJson(projectRoot),
    readReadme(projectRoot),
    readGitInfo(projectRoot),
    listRowlFiles(projectRoot),
  ]);
  return {
    ...packageJson,
    ...readme,
    ...git,
    rowlFiles,
  };
}

async function readPackageJson(projectRoot: string): Promise<Omit<WorkspaceContext, "rowlFiles">> {
  const packagePath = path.join(projectRoot, "package.json");
  let raw: string;
  try {
    raw = await fs.readFile(packagePath, "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        scripts: [],
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        optionalDependencies: {},
      };
    }
    throw cause;
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const result: Omit<WorkspaceContext, "rowlFiles"> = {
    scripts: Object.keys(recordField(parsed.scripts)),
    dependencies: recordField(parsed.dependencies),
    devDependencies: recordField(parsed.devDependencies),
    peerDependencies: recordField(parsed.peerDependencies),
    optionalDependencies: recordField(parsed.optionalDependencies),
  };
  const packageName = stringField(parsed.name);
  const packageDescription = stringField(parsed.description);
  const packageManager = stringField(parsed.packageManager);
  return {
    ...result,
    ...(packageName ? { packageName } : {}),
    ...(packageDescription ? { packageDescription } : {}),
    ...(packageManager ? { packageManager } : {}),
  };
}

async function readReadme(
  projectRoot: string,
): Promise<Pick<WorkspaceContext, "readmePath" | "readmeExcerpt">> {
  const entries = ["README.md", "README.mdx", "readme.md", "Readme.md"];
  for (const entry of entries) {
    const filePath = path.join(projectRoot, entry);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return {
        readmePath: entry,
        readmeExcerpt: excerptMarkdown(raw, 1800),
      };
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
    }
  }
  return {};
}

async function readGitInfo(
  projectRoot: string,
): Promise<Pick<WorkspaceContext, "gitBranch" | "gitRemote">> {
  const gitDir = await resolveGitDir(projectRoot);
  if (!gitDir) return {};
  const head = await readOptionalFile(path.join(gitDir, "HEAD"));
  const config = await readOptionalFile(path.join(gitDir, "config"));
  const gitBranch = parseGitBranch(head);
  const gitRemote = parseGitRemote(config);
  return {
    ...(gitBranch ? { gitBranch } : {}),
    ...(gitRemote ? { gitRemote } : {}),
  };
}

async function resolveGitDir(projectRoot: string): Promise<string | null> {
  const dotGit = path.join(projectRoot, ".git");
  try {
    const stat = await fs.stat(dotGit);
    if (stat.isDirectory()) return dotGit;
    if (stat.isFile()) {
      const raw = await fs.readFile(dotGit, "utf8");
      const match = /^gitdir:\s*(.+)\s*$/m.exec(raw);
      if (match?.[1]) {
        return path.resolve(projectRoot, match[1]);
      }
    }
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
  }
  return null;
}

async function listRowlFiles(projectRoot: string): Promise<ReadonlyArray<string>> {
  const root = path.join(projectRoot, ".rowl");
  const results: string[] = [];
  await walkRowl(root, "", results, 0);
  return results.toSorted();
}

async function walkRowl(
  root: string,
  relativeDir: string,
  results: string[],
  depth: number,
): Promise<void> {
  if (depth > 2 || results.length >= 25) return;
  let entries: ReadonlyArray<{
    readonly name: string;
    readonly isDirectory: () => boolean;
    readonly isFile: () => boolean;
  }>;
  try {
    entries = await fs.readdir(path.join(root, relativeDir), { withFileTypes: true });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return;
    throw cause;
  }
  for (const entry of entries) {
    if (results.length >= 25) return;
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      await walkRowl(root, relativePath, results, depth + 1);
    } else if (entry.isFile()) {
      results.push(path.join(".rowl", relativePath));
    }
  }
}

async function inspectAgentMetadataConsistency(input: {
  readonly service: Pick<CoreAgentService, "listAgents">;
  readonly scope: CoreAgentScope;
  readonly stateDir: string | undefined;
  readonly agentId: string;
}): Promise<{ readonly findings: string[]; readonly fixes: string[] }> {
  const findings: string[] = [];
  const fixes: string[] = [];
  const list = await input.service.listAgents({ scope: input.scope });
  if (list.agents.some((agent) => agent.id === input.agentId)) {
    findings.push("Active agent appears in the scoped agent list.");
  } else {
    findings.push("Active agent does not appear in the scoped agent list.");
    fixes.push("Switch to an existing agent with /switch, or recreate the missing active agent.");
  }

  const metadataPath = metadataPathForScope(input.scope, input.stateDir, input.agentId);
  if (!metadataPath) {
    findings.push("Metadata file check skipped because the server state directory is unavailable.");
    return { findings, fixes };
  }

  try {
    const raw = JSON.parse(await fs.readFile(metadataPath, "utf8")) as Record<string, unknown>;
    const metadata = readAgentMetadata(metadataPath);
    if (metadata.id === input.agentId) {
      findings.push("Agent metadata.json matches the active agent id.");
    } else {
      findings.push(`Agent metadata.json id mismatch: ${metadata.id}.`);
      fixes.push("Recreate or repair the active agent metadata.json file.");
    }
    const scopeMatches =
      metadata.scope.type === input.scope.type &&
      (metadata.scope.type === "global" ||
        (input.scope.type === "project" && metadata.scope.projectRoot === input.scope.projectRoot));
    findings.push(
      scopeMatches
        ? "Agent metadata.json scope matches the active scope."
        : "Agent metadata.json scope does not match the active scope.",
    );
    if (!scopeMatches) {
      fixes.push("Move or recreate the agent metadata in the correct scope.");
    }
    if (Object.prototype.hasOwnProperty.call(raw, "memoryNotes")) {
      findings.push("Legacy metadata memoryNotes field is still present.");
      fixes.push("Run the memory note migration before relying on file-based memory.");
    }
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      findings.push("Agent metadata.json is missing.");
    } else {
      findings.push("Agent metadata.json could not be parsed.");
    }
    fixes.push("Recreate or repair the active agent metadata.json file.");
  }
  return { findings, fixes };
}

function metadataPathForScope(
  scope: CoreAgentScope,
  stateDir: string | undefined,
  agentId: string,
): string | null {
  if (scope.type === "project") {
    return resolveProjectAgentMetadataPath(scope.projectRoot, agentId);
  }
  return stateDir ? resolveGlobalAgentMetadataPath(stateDir, agentId) : null;
}

function formatProjectOverview(context: WorkspaceContext): string {
  const lines = ["# Project overview", ""];
  if (context.packageName) lines.push(`- Package: ${context.packageName}`);
  if (context.packageDescription) lines.push(`- Description: ${context.packageDescription}`);
  if (context.gitBranch) lines.push(`- Git branch: ${context.gitBranch}`);
  if (context.gitRemote) lines.push(`- Git remote: ${context.gitRemote}`);
  if (context.packageName || context.packageDescription || context.gitBranch || context.gitRemote) {
    lines.push("");
  }
  if (context.readmeExcerpt) {
    lines.push(`## README (${context.readmePath ?? "README"})`, "", context.readmeExcerpt);
  } else {
    lines.push("No README was found during /init.");
  }
  return lines.join("\n").trim();
}

function formatTechStack(context: WorkspaceContext): string {
  const lines = ["# Tech stack", ""];
  if (context.packageManager) {
    lines.push(`- Package manager: ${context.packageManager}`);
  }
  if (context.scripts.length > 0) {
    lines.push(`- Scripts: ${context.scripts.join(", ")}`);
  }
  appendDependencySection(lines, "Dependencies", context.dependencies);
  appendDependencySection(lines, "Dev dependencies", context.devDependencies);
  appendDependencySection(lines, "Peer dependencies", context.peerDependencies);
  appendDependencySection(lines, "Optional dependencies", context.optionalDependencies);
  if (lines.length === 2) {
    lines.push("No package.json dependency metadata was found during /init.");
  }
  return lines.join("\n").trim();
}

function appendDependencySection(
  lines: string[],
  title: string,
  dependencies: Readonly<Record<string, string>>,
): void {
  const entries = Object.entries(dependencies).toSorted(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return;
  lines.push("", `## ${title}`);
  for (const [name, version] of entries) {
    lines.push(`- ${name}: ${version}`);
  }
}

function normalizeConversationMessages(
  messages: ReadonlyArray<CoreAgentConversationMessage> | undefined,
): ReadonlyArray<{ role: string; content: string }> {
  return (messages ?? [])
    .map((message) => ({
      role: message.role,
      content: (message.content ?? message.text ?? "").trim(),
    }))
    .filter((message) => message.content.length > 0)
    .filter((message) => !/^\/compact\s*$/i.test(message.content));
}

function summarizeConversationHeuristically(
  messages: ReadonlyArray<{ role: string; content: string }>,
): string {
  if (messages.length === 0) {
    return "No prior conversation messages were available to compact.";
  }

  const userMessages = messages.filter((message) => message.role === "user");
  const assistantMessages = messages.filter((message) => message.role === "assistant");
  const recentRequests = userMessages
    .map((message) => firstSentence(message.content))
    .filter(Boolean)
    .slice(-5);
  const assistantActions = assistantMessages
    .flatMap((message) => extractActionSentences(message.content))
    .slice(-8);

  const sections: string[] = [];
  if (recentRequests.length > 0) {
    sections.push("User requests:\n" + recentRequests.map((request) => `- ${request}`).join("\n"));
  }
  if (assistantActions.length > 0) {
    sections.push(
      "Assistant actions:\n" + assistantActions.map((action) => `- ${action}`).join("\n"),
    );
  }
  sections.push(
    `Conversation shape: ${userMessages.length} user message${userMessages.length === 1 ? "" : "s"}, ${assistantMessages.length} assistant response${assistantMessages.length === 1 ? "" : "s"}.`,
  );
  return sections.join("\n\n");
}

function firstSentence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const sentence = /(.{20,220}?[.!?])(?:\s|$)/.exec(normalized)?.[1] ?? normalized.slice(0, 220);
  return sentence.trim();
}

function extractActionSentences(value: string): string[] {
  const normalized = value.replace(/\s+/g, " ").trim();
  const sentences = normalized.split(/(?<=[.!?])\s+/g);
  return sentences
    .filter((sentence) =>
      /\b(added|built|changed|created|deleted|fixed|implemented|moved|read|removed|renamed|updated|verified|wrote)\b/i.test(
        sentence,
      ),
    )
    .map((sentence) => sentence.slice(0, 220).trim())
    .filter(Boolean);
}

function timestampSlug(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14) || "unknown";
}

function countTags(tags: ReadonlyArray<string>): ReadonlyArray<readonly [string, number]> {
  const counts = new Map<string, number>();
  for (const tag of tags) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function duplicateValues(values: ReadonlyArray<string>): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function isEffectivelyEmptyNote(content: string): boolean {
  const stripped = content
    .split(/\r?\n/g)
    .filter((line) => !/^#{1,6}\s+\S/.test(line.trim()))
    .join("\n")
    .trim();
  return stripped.length === 0 || /^\(?empty\b/i.test(stripped);
}

function parseGitBranch(head: string | undefined): string | undefined {
  const trimmed = head?.trim();
  if (!trimmed) return undefined;
  const match = /^ref:\s+refs\/heads\/(.+)$/.exec(trimmed);
  return match?.[1] ?? trimmed.slice(0, 12);
}

function parseGitRemote(config: string | undefined): string | undefined {
  if (!config) return undefined;
  const match = /^\s*url\s*=\s*(.+?)\s*$/m.exec(config);
  return match?.[1];
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw cause;
  }
}

function excerptMarkdown(raw: string, maxChars: number): string {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  return normalized.length > maxChars
    ? `${normalized.slice(0, maxChars).trimEnd()}\n...`
    : normalized;
}

function recordField(value: unknown): Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .toSorted(([a], [b]) => a.localeCompare(b)),
  );
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function dedupe(values: ReadonlyArray<string>): string[] {
  return [...new Set(values)];
}

function findPreset(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    getPersonalityPreset(normalized) ??
    CORE_AGENT_PERSONALITY_PRESETS.find((preset) => preset.displayName.toLowerCase() === normalized)
  );
}

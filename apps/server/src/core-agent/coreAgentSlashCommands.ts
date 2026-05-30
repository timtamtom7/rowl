import fs from "node:fs/promises";
import path from "node:path";

import type { CoreAgentMetadata, CoreAgentScope } from "@t3tools/contracts";
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
  | { readonly kind: "doctor" };

export type CoreAgentSlashCommandResult = {
  readonly handled: true;
  readonly response: string;
};

export function parseCoreAgentSlashCommand(text: string): CoreAgentSlashCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const match = /^\/([A-Za-z][A-Za-z0-9_-]*)(?:\s+([\s\S]*))?$/.exec(trimmed);
  if (!match) return null;

  const command = (match[1] ?? "").toLowerCase();
  const rest = unquote((match[2] ?? "").trim());
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
  return null;
}

export async function executeCoreAgentSlashCommand(input: {
  readonly service: Pick<
    CoreAgentService,
    "listAgents" | "resolveActiveAgent" | "setActiveAgent" | "updateAgent"
  >;
  readonly memory?: Pick<MemoryPalaceServiceShape, "list" | "read" | "write">;
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
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars).trimEnd()}\n...` : normalized;
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

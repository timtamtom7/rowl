/**
 * CoreMemoryLive — filesystem-backed implementation of CoreMemoryService.
 *
 * Seeds default blocks on first use (idempotent) and lists blocks from disk.
 * Git-init and write-through-git are layered on top in a later task.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { Effect, Layer } from "effect";
import { listBlocksInDir, writeBlockToDir } from "../blockFiles.ts";
import { DEFAULT_GLOBAL_BLOCKS, DEFAULT_PROJECT_BLOCKS } from "../defaultBlocks.ts";
import { commitMemoryChanges, ensureMemoryRepo } from "../memoryGit.ts";
import {
  globalAgentMemoryDir,
  globalAgentsRoot,
  normalizeMemoryAgentId,
  projectMemoryDir,
} from "../paths.ts";
import { CoreMemoryService, type CoreMemoryAgentContext } from "../Services/CoreMemoryService.ts";

async function dirHasAnyBlocks(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir);
    return entries.some((e) => e.endsWith(".md"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

/**
 * Ensure the project's .gitignore has `.rowl/memory/` listed. Project memory
 * is gitignored by default in phase 1a (opt-in commit is phase 1b). This is
 * idempotent and preserves existing gitignore content.
 */
async function ensureProjectGitignoresMemory(projectRoot: string): Promise<void> {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  let existing = "";
  try {
    existing = await fs.readFile(gitignorePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  const lines = existing.split(/\r?\n/);
  if (lines.some((l) => l.trim() === ".rowl/memory/")) return;
  const next =
    existing.endsWith("\n") || existing.length === 0
      ? `${existing}.rowl/memory/\n`
      : `${existing}\n.rowl/memory/\n`;
  await fs.writeFile(gitignorePath, next, "utf8");
}

async function readActiveAgentId(filePath: string): Promise<string | undefined> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
  const parsed = JSON.parse(raw) as { readonly activeAgentId?: unknown };
  return typeof parsed.activeAgentId === "string"
    ? normalizeMemoryAgentId(parsed.activeAgentId)
    : undefined;
}

async function resolveMemoryAgentId(
  stateDir: string,
  input: CoreMemoryAgentContext | undefined,
): Promise<string> {
  if (input?.agentId) {
    return normalizeMemoryAgentId(input.agentId);
  }

  if (input?.projectRoot) {
    const projectActiveAgentId = await readActiveAgentId(
      path.join(input.projectRoot, ".rowl", "agents", "active-agent.json"),
    );
    if (projectActiveAgentId) return projectActiveAgentId;
  }

  return (
    (await readActiveAgentId(path.join(globalAgentsRoot(stateDir), "active-agent.json"))) ??
    normalizeMemoryAgentId(undefined)
  );
}

export function CoreMemoryLive(config: {
  readonly stateDir: string;
}): Layer.Layer<CoreMemoryService> {
  return Layer.succeed(CoreMemoryService, {
    listGlobal: (input) =>
      Effect.promise(async () => {
        const agentId = await resolveMemoryAgentId(config.stateDir, input);
        return listBlocksInDir(globalAgentMemoryDir(config.stateDir, agentId));
      }),

    listProject: (input) =>
      Effect.promise(async () => {
        await resolveMemoryAgentId(config.stateDir, input);
        return listBlocksInDir(projectMemoryDir(input.projectRoot));
      }),

    ensureGlobalSeeded: (input) =>
      Effect.promise(async () => {
        const agentId = await resolveMemoryAgentId(config.stateDir, input);
        const dir = globalAgentMemoryDir(config.stateDir, agentId);
        if (await dirHasAnyBlocks(dir)) return;
        for (const block of DEFAULT_GLOBAL_BLOCKS) {
          await writeBlockToDir(dir, block);
        }
        await ensureMemoryRepo(dir);
        await commitMemoryChanges(dir, "rowl: seed default blocks");
      }),

    ensureProjectSeeded: (input) =>
      Effect.promise(async () => {
        await resolveMemoryAgentId(config.stateDir, input);
        await ensureProjectGitignoresMemory(input.projectRoot);
        const dir = projectMemoryDir(input.projectRoot);
        if (await dirHasAnyBlocks(dir)) return;
        for (const block of DEFAULT_PROJECT_BLOCKS) {
          await writeBlockToDir(dir, block);
        }
        await ensureMemoryRepo(dir);
        await commitMemoryChanges(dir, "rowl: seed default blocks");
      }),
  });
}

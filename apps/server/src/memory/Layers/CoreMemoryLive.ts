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
import { DEFAULT_AGENT_ID, globalAgentMemoryDir, projectMemoryDir } from "../paths.ts";
import { CoreMemoryService } from "../Services/CoreMemoryService.ts";

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

export function CoreMemoryLive(config: {
  readonly stateDir: string;
}): Layer.Layer<CoreMemoryService> {
  return Layer.succeed(CoreMemoryService, {
    listGlobal: () =>
      Effect.promise(() =>
        listBlocksInDir(globalAgentMemoryDir(config.stateDir, DEFAULT_AGENT_ID)),
      ),

    listProject: (input) =>
      Effect.promise(() => listBlocksInDir(projectMemoryDir(input.projectRoot))),

    ensureGlobalSeeded: () =>
      Effect.promise(async () => {
        const dir = globalAgentMemoryDir(config.stateDir, DEFAULT_AGENT_ID);
        if (await dirHasAnyBlocks(dir)) return;
        for (const block of DEFAULT_GLOBAL_BLOCKS) {
          await writeBlockToDir(dir, block);
        }
        await ensureMemoryRepo(dir);
        await commitMemoryChanges(dir, "rowl: seed default blocks");
      }),

    ensureProjectSeeded: (input) =>
      Effect.promise(async () => {
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

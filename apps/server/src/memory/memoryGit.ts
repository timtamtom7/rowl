/**
 * Git-backing for memory directories.
 *
 * Each memory dir (global + per-project) is its own git repo. We commit on
 * seed and after any turn that changed memory files. The operations are
 * narrow and boundary-y, so we shell out to `git` directly instead of
 * depending on the larger GitCore service layer.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureMemoryRepo(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  if (await exists(path.join(dir, ".git"))) return;
  await run("git", ["init"], { cwd: dir });
  await run("git", ["config", "user.email", "memory@rowl.local"], { cwd: dir });
  await run("git", ["config", "user.name", "Rowl Memory"], { cwd: dir });
}

export async function commitMemoryChanges(dir: string, message: string): Promise<void> {
  // If the dir is not a repo, nothing to do. (Caller should have run
  // ensureMemoryRepo, but tolerate misuse to keep turn hooks robust.)
  if (!(await exists(path.join(dir, ".git")))) return;
  await run("git", ["add", "-A"], { cwd: dir });
  try {
    await run("git", ["diff", "--cached", "--quiet"], { cwd: dir });
    return; // exit 0 = no changes staged
  } catch {
    // non-zero exit = there ARE changes; fall through and commit
  }
  await run("git", ["commit", "-m", message], { cwd: dir });
}

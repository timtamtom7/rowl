import fs from "node:fs/promises";
import path from "node:path";

import { Goal, GoalId, type Goal as GoalType } from "@t3tools/contracts";
import { Schema } from "effect";

export function goalsRootDir(stateDir: string): string {
  return path.join(stateDir, "goals");
}

export function goalDir(stateDir: string, goalId: GoalId | string): string {
  return path.join(goalsRootDir(stateDir), String(goalId));
}

export function goalMetadataPath(stateDir: string, goalId: GoalId | string): string {
  return path.join(goalDir(stateDir, goalId), "metadata.json");
}

export async function readGoalMetadata(
  stateDir: string,
  goalId: GoalId | string,
): Promise<GoalType | null> {
  const filePath = goalMetadataPath(stateDir, goalId);
  try {
    const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    return Schema.decodeUnknownSync(Goal)(raw);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw cause;
  }
}

export async function writeGoalMetadata(input: {
  readonly stateDir: string;
  readonly goal: GoalType;
}): Promise<void> {
  const filePath = goalMetadataPath(input.stateDir, input.goal.id);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(input.goal, null, 2)}\n`, "utf8");
}

export async function deleteGoalFiles(stateDir: string, goalId: GoalId | string): Promise<void> {
  await fs.rm(goalDir(stateDir, goalId), { recursive: true, force: true });
}

export async function listGoalMetadata(stateDir: string): Promise<GoalType[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(goalsRootDir(stateDir));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw cause;
  }

  const goals: GoalType[] = [];
  for (const entry of entries) {
    const metadata = await readGoalMetadata(stateDir, entry);
    if (metadata) goals.push(metadata);
  }
  return goals;
}

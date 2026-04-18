/**
 * Low-level memory block filesystem operations.
 * Pure IO — no Effect, no service layer; used by CoreMemoryService live layer.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseBlock, serializeBlock, type MemoryBlock } from "./block.ts";

export function blockFileName(label: string): string {
  const safe = label.replaceAll(/[\\/]/g, "_");
  return `${safe}.md`;
}

export async function writeBlockToDir(dir: string, block: MemoryBlock): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, blockFileName(block.label));
  await fs.writeFile(filePath, serializeBlock(block), "utf8");
}

export async function readBlockFromDir(
  dir: string,
  label: string,
): Promise<MemoryBlock | null> {
  const filePath = path.join(dir, blockFileName(label));
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  return parseBlock(raw);
}

export async function listBlocksInDir(
  dir: string,
): Promise<ReadonlyArray<MemoryBlock>> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const blocks: MemoryBlock[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const raw = await fs.readFile(path.join(dir, entry), "utf8");
    try {
      blocks.push(parseBlock(raw));
    } catch {
      // Skip unparseable files; later tasks may surface these via a diagnostic.
    }
  }
  blocks.sort((a, b) => a.label.localeCompare(b.label));
  return blocks;
}

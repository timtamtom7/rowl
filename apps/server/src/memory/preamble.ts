/**
 * Assemble the memory preamble injected into every turn.
 *
 * Format (per SPEC §5):
 *   ## {label} — {description}
 *   {body}
 *
 * Global blocks come first, then project blocks. Within each group, well-known
 * labels come first in a fixed order; remaining labels are alphabetical.
 */
import type { MemoryBlock } from "./block.ts";

const GLOBAL_WELL_KNOWN = ["persona", "human", "preferences"] as const;
const PROJECT_WELL_KNOWN = [
  "overview",
  "architecture",
  "conventions",
  "decisions",
  "current-focus",
] as const;

function orderBlocks(
  blocks: ReadonlyArray<MemoryBlock>,
  wellKnown: ReadonlyArray<string>,
): ReadonlyArray<MemoryBlock> {
  const byLabel = new Map(blocks.map((b) => [b.label, b]));
  const ordered: MemoryBlock[] = [];
  for (const label of wellKnown) {
    const b = byLabel.get(label);
    if (b) {
      ordered.push(b);
      byLabel.delete(label);
    }
  }
  const rest = [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
  return [...ordered, ...rest];
}

function renderBlock(block: MemoryBlock): string | null {
  const trimmed = block.body.trim();
  if (trimmed.length === 0) return null;
  return `## ${block.label} — ${block.description}\n${trimmed}`;
}

export function assembleMemoryPreamble(input: {
  readonly global: ReadonlyArray<MemoryBlock>;
  readonly project: ReadonlyArray<MemoryBlock>;
}): string | null {
  const parts: string[] = [];
  for (const b of orderBlocks(input.global, GLOBAL_WELL_KNOWN)) {
    const rendered = renderBlock(b);
    if (rendered) parts.push(rendered);
  }
  for (const b of orderBlocks(input.project, PROJECT_WELL_KNOWN)) {
    const rendered = renderBlock(b);
    if (rendered) parts.push(rendered);
  }
  if (parts.length === 0) return null;
  return parts.join("\n\n");
}

/**
 * MemoryBlock — a named, versioned piece of persistent agent memory.
 * Persisted as a markdown file with flat YAML frontmatter.
 */
import { parseFlatFrontmatter, parseFrontmatterSection } from "@t3tools/shared/frontmatter";

export type MemoryScope = "global" | "project";

export interface MemoryBlock {
  readonly label: string;
  readonly description: string;
  readonly readOnly: boolean;
  readonly scope: MemoryScope;
  readonly version: number;
  readonly body: string;
}

function needsQuoting(value: string): boolean {
  return /[:#]/.test(value) || value.trim() !== value;
}

function emitString(value: string): string {
  if (!needsQuoting(value)) return value;
  const escaped = value.replaceAll('"', '\\"');
  return `"${escaped}"`;
}

export function serializeBlock(block: MemoryBlock): string {
  const frontmatter = [
    "---",
    `label: ${emitString(block.label)}`,
    `description: ${emitString(block.description)}`,
    `read_only: ${block.readOnly ? "true" : "false"}`,
    `scope: ${block.scope}`,
    `version: ${block.version}`,
    "---",
  ].join("\n");
  const trimmedBody = block.body.trim();
  // Format: frontmatter block, one blank line, body, trailing newline.
  // Empty body: frontmatter + trailing newline only (still one blank line after ---).
  return trimmedBody.length === 0 ? `${frontmatter}\n\n` : `${frontmatter}\n\n${trimmedBody}\n`;
}

export function parseBlock(raw: string): MemoryBlock {
  const { frontmatter, body } = parseFrontmatterSection(raw);
  const fm = parseFlatFrontmatter(frontmatter);

  const label = fm.label;
  const description = fm.description;
  const scope = fm.scope;

  if (typeof label !== "string" || label.length === 0) {
    throw new Error("Memory block frontmatter requires a non-empty 'label'.");
  }
  if (typeof description !== "string" || description.length === 0) {
    throw new Error("Memory block frontmatter requires a non-empty 'description'.");
  }
  if (scope !== "global" && scope !== "project") {
    throw new Error(
      `Memory block frontmatter 'scope' must be 'global' or 'project', got '${String(scope)}'.`,
    );
  }

  const readOnlyRaw = fm.read_only;
  const readOnly = typeof readOnlyRaw === "boolean" ? readOnlyRaw : false;

  const versionRaw = fm.version;
  const versionParsed =
    typeof versionRaw === "string" ? Number.parseInt(versionRaw, 10) : Number.NaN;
  const version = Number.isFinite(versionParsed) && versionParsed >= 1 ? versionParsed : 1;

  return {
    label,
    description,
    readOnly,
    scope,
    version,
    body,
  };
}

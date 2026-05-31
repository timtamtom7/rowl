/**
 * Shared YAML-ish frontmatter parser for Rowl.
 *
 * Handles the flat-key-value frontmatter format used across Rowl's various
 * project artifacts: `.rowl/commands/*.md`, `.rowl/skills/*.md`, and (from
 * phase 1a onward) `.rowl/memory/*.md` and agent memory blocks.
 *
 * Not a full YAML parser — supports:
 *   - string values (optionally single- or double-quoted)
 *   - boolean values (`true` / `false`)
 *   - comment lines (`# …`) and blank lines
 *
 * Extracted from apps/server/src/projectWorkspaceMetadata.ts so both the
 * server and memory modules can share a single implementation.
 */

export function parseFrontmatterSection(raw: string): {
  frontmatter: string;
  body: string;
} {
  if (!raw.startsWith("---")) {
    throw new Error("Expected YAML frontmatter fenced by ---.");
  }
  const lines = raw.split(/\r?\n/g);
  if (lines[0] !== "---") {
    throw new Error("Frontmatter must start on the first line.");
  }
  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (closingIndex < 0) {
    throw new Error("Frontmatter is missing a closing --- line.");
  }
  return {
    frontmatter: lines.slice(1, closingIndex).join("\n"),
    body: lines
      .slice(closingIndex + 1)
      .join("\n")
      .trim(),
  };
}

export function parseFrontmatterValue(rawValue: string): string | boolean {
  const trimmed = rawValue.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseFlatFrontmatter(frontmatter: string): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const line of frontmatter.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex <= 0) {
      throw new Error(`Invalid frontmatter line '${trimmed}'.`);
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1);
    result[key] = parseFrontmatterValue(rawValue);
  }
  return result;
}

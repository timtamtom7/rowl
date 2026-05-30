import fs from "node:fs/promises";
import path from "node:path";

import {
  CoreAgentId,
  type CoreAgentScope,
  type MemoryNote,
  type MemoryNoteListResponse,
  type MemoryNoteSummary,
} from "@t3tools/contracts";
import { parseFlatFrontmatter, parseFrontmatterSection } from "@t3tools/shared/frontmatter";
import { Effect, Layer, Schema, ServiceMap } from "effect";

import { blockFileName } from "../memory/blockFiles.ts";
import { globalAgentMemoryDir, projectMemoryDir } from "../memory/paths.ts";
import { readAgentMetadata, writeAgentMetadata } from "./agentMetadataStore.ts";

export type MemoryPalaceListRequest = {
  readonly scope: CoreAgentScope;
  readonly agentId: string;
};

export type MemoryPalaceReadRequest = MemoryPalaceListRequest & {
  readonly filename: string;
};

export type MemoryPalaceWriteRequest = MemoryPalaceReadRequest & {
  readonly title: string;
  readonly content: string;
  readonly tags?: ReadonlyArray<string>;
};

export type MemoryPalaceDeleteRequest = MemoryPalaceReadRequest;

export interface MemoryPalaceServiceShape {
  readonly list: (request: MemoryPalaceListRequest) => Effect.Effect<MemoryNoteListResponse>;
  readonly read: (request: MemoryPalaceReadRequest) => Effect.Effect<MemoryNote>;
  readonly write: (request: MemoryPalaceWriteRequest) => Effect.Effect<MemoryNote>;
  readonly delete: (request: MemoryPalaceDeleteRequest) => Effect.Effect<void>;
}

export class MemoryPalaceService extends ServiceMap.Service<
  MemoryPalaceService,
  MemoryPalaceServiceShape
>()("rowl/core-agent/MemoryPalaceService") {}

export class MemoryPalaceError extends Error {
  readonly kind: "invalid-filename" | "note-not-found" | "invalid-note";
  readonly filename: string | undefined;

  constructor(input: {
    readonly kind: MemoryPalaceError["kind"];
    readonly message: string;
    readonly filename?: string;
    readonly cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "MemoryPalaceError";
    this.kind = input.kind;
    this.filename = input.filename;
  }
}

export type MemoryPalaceLiveOptions = {
  readonly stateDir: string;
  readonly now?: () => string;
};

const decodeAgentId = Schema.decodeUnknownSync(CoreAgentId);
const NOTE_FILENAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export function MemoryPalaceLive(options: MemoryPalaceLiveOptions): Layer.Layer<MemoryPalaceService> {
  return Layer.succeed(MemoryPalaceService, createMemoryPalaceService(options));
}

export function createMemoryPalaceService(
  options: MemoryPalaceLiveOptions,
): MemoryPalaceServiceShape {
  const now = options.now ?? (() => new Date().toISOString());

  return {
    list: (request) =>
      Effect.promise(async () => {
        const dir = memoryDirForRequest(options.stateDir, request);
        const entries = await listMarkdownFiles(dir);
        const notes: MemoryNoteSummary[] = [];
        for (const entry of entries) {
          try {
            const note = await readNoteFile(path.join(dir, entry));
            notes.push(toSummary(note));
          } catch {
            // Keep the viewer resilient; malformed files can be surfaced by /doctor later.
          }
        }
        notes.sort((a, b) => a.filename.localeCompare(b.filename));
        return { notes };
      }),

    read: (request) =>
      Effect.promise(async () => {
        const filePath = notePathForRequest(options.stateDir, request);
        try {
          return await readNoteFile(filePath);
        } catch (cause) {
          if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
            throw new MemoryPalaceError({
              kind: "note-not-found",
              filename: request.filename,
              message: `Memory note not found: ${request.filename}`,
              cause,
            });
          }
          throw cause;
        }
      }),

    write: (request) =>
      Effect.promise(async () => {
        const filePath = notePathForRequest(options.stateDir, request);
        const existing = await readExistingNote(filePath);
        const created = existing?.created ?? now();
        const updated = now();
        const content = serializeNote({
          filename: normalizeFilename(request.filename),
          title: request.title,
          tags: request.tags ?? [],
          created,
          updated,
          content: request.content,
          scope: request.scope.type,
        });
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, "utf8");
        return readNoteFile(filePath);
      }),

    delete: (request) =>
      Effect.promise(async () => {
        await fs.rm(notePathForRequest(options.stateDir, request), { force: true });
      }),
  };
}

export async function migrateMemoryNotesFromAgentMetadata(input: {
  readonly stateDir: string;
  readonly metadataPath: string;
  readonly now?: () => string;
}): Promise<{ readonly migrated: number; readonly agentId: string }> {
  const raw = JSON.parse(await fs.readFile(input.metadataPath, "utf8")) as Record<string, unknown>;
  const agentId = decodeAgentId(raw.id);
  const memoryNotes = normalizeLegacyMemoryNotes(raw.memoryNotes, input.now ?? (() => new Date().toISOString()));
  if (memoryNotes.length === 0) {
    return { migrated: 0, agentId };
  }

  const dir = globalAgentMemoryDir(input.stateDir, agentId);
  await fs.mkdir(dir, { recursive: true });
  for (const note of memoryNotes) {
    await fs.writeFile(
      path.join(dir, blockFileName(note.filename)),
      serializeNote({ ...note, scope: "global" }),
      "utf8",
    );
  }

  delete raw.memoryNotes;
  const decoded = readAgentMetadataAfterRemovingLegacyField(raw, input.metadataPath);
  writeAgentMetadata({ filePath: input.metadataPath, metadata: decoded });
  return { migrated: memoryNotes.length, agentId };
}

export async function migrateGlobalAgentMetadataMemoryNotes(input: {
  readonly stateDir: string;
  readonly now?: () => string;
}): Promise<{ readonly migrated: number; readonly agents: number }> {
  const agentsRoot = path.join(input.stateDir, "agents");
  let entries: string[];
  try {
    entries = await fs.readdir(agentsRoot);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      return { migrated: 0, agents: 0 };
    }
    throw cause;
  }

  let migrated = 0;
  let agents = 0;
  for (const entry of entries) {
    const metadataPath = path.join(agentsRoot, entry, "metadata.json");
    try {
      const result = await migrateMemoryNotesFromAgentMetadata({
        stateDir: input.stateDir,
        metadataPath,
        now: input.now,
      });
      if (result.migrated > 0) {
        agents += 1;
        migrated += result.migrated;
      }
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== "ENOENT") {
        throw cause;
      }
    }
  }
  return { migrated, agents };
}

function memoryDirForRequest(stateDir: string, request: MemoryPalaceListRequest): string {
  return request.scope.type === "project"
    ? projectMemoryDir(request.scope.projectRoot)
    : globalAgentMemoryDir(stateDir, request.agentId);
}

function notePathForRequest(stateDir: string, request: MemoryPalaceReadRequest): string {
  return path.join(memoryDirForRequest(stateDir, request), blockFileName(normalizeFilename(request.filename)));
}

function normalizeFilename(filename: string): string {
  const normalized = filename.trim().toLowerCase();
  if (!NOTE_FILENAME_RE.test(normalized)) {
    throw new MemoryPalaceError({
      kind: "invalid-filename",
      filename,
      message: `Memory note filename must be a slug: ${filename}`,
    });
  }
  return normalized;
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).filter((entry) => entry.endsWith(".md"));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw cause;
  }
}

async function readExistingNote(filePath: string): Promise<MemoryNote | null> {
  try {
    return await readNoteFile(filePath);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return null;
    return null;
  }
}

async function readNoteFile(filePath: string): Promise<MemoryNote> {
  const raw = await fs.readFile(filePath, "utf8");
  const filename = path.basename(filePath, ".md");
  try {
    const { frontmatter, body } = parseFrontmatterSection(raw);
    const fm = parseFlatFrontmatter(frontmatter);
    const title = firstHeading(body) ?? stringField(fm.title) ?? stringField(fm.description) ?? filename;
    const created = stringField(fm.created) ?? fallbackIsoDate();
    const updated = stringField(fm.updated) ?? created;
    return {
      filename,
      title,
      tags: parseTags(fm.tags),
      created,
      updated,
      content: body.trim(),
    };
  } catch (cause) {
    throw new MemoryPalaceError({
      kind: "invalid-note",
      filename,
      message: `Invalid memory note: ${filename}`,
      cause,
    });
  }
}

function toSummary(note: MemoryNote): MemoryNoteSummary {
  const { content: _content, ...summary } = note;
  return summary;
}

function serializeNote(input: {
  readonly filename: string;
  readonly title: string;
  readonly tags: ReadonlyArray<string>;
  readonly created: string;
  readonly updated: string;
  readonly content: string;
  readonly scope: "global" | "project";
}): string {
  const title = input.title.trim() || input.filename;
  const body = input.content.trim().length > 0 ? input.content.trim() : `# ${title}`;
  const frontmatter = [
    "---",
    `label: ${input.filename}`,
    `description: ${escapeScalar(title)}`,
    "read_only: false",
    `scope: ${input.scope}`,
    "version: 1",
    `tags: [${input.tags.map((tag) => tag.trim()).filter(Boolean).join(", ")}]`,
    `created: ${input.created}`,
    `updated: ${input.updated}`,
    "---",
  ].join("\n");
  return `${frontmatter}\n\n${body}\n`;
}

function escapeScalar(value: string): string {
  return /[:#[\],]/.test(value) || value.trim() !== value
    ? `"${value.replaceAll('"', '\\"')}"`
    : value;
}

function parseTags(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  const inner = trimmed.startsWith("[") && trimmed.endsWith("]")
    ? trimmed.slice(1, -1)
    : trimmed;
  return inner
    .split(",")
    .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function firstHeading(markdown: string): string | undefined {
  for (const line of markdown.split(/\r?\n/g)) {
    const match = /^#\s+(.+?)\s*$/.exec(line);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function fallbackIsoDate(): string {
  return new Date(0).toISOString();
}

type NormalizedLegacyNote = {
  readonly filename: string;
  readonly title: string;
  readonly tags: ReadonlyArray<string>;
  readonly created: string;
  readonly updated: string;
  readonly content: string;
};

function normalizeLegacyMemoryNotes(value: unknown, now: () => string): NormalizedLegacyNote[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (typeof entry === "string") {
      const title = firstHeading(entry) ?? `Memory note ${index + 1}`;
      return [
        {
          filename: slugify(title),
          title,
          tags: [],
          created: now(),
          updated: now(),
          content: entry,
        },
      ];
    }
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const content = stringField(raw.content) ?? stringField(raw.body) ?? "";
    if (!content.trim()) return [];
    const title = stringField(raw.title) ?? firstHeading(content) ?? `Memory note ${index + 1}`;
    const filename = stringField(raw.filename) ?? slugify(title);
    return [
      {
        filename: normalizeFilename(slugify(filename)),
        title,
        tags: Array.isArray(raw.tags)
          ? raw.tags.flatMap((tag) => (typeof tag === "string" ? [tag] : []))
          : parseTags(raw.tags),
        created: stringField(raw.created) ?? now(),
        updated: stringField(raw.updated) ?? now(),
        content,
      },
    ];
  });
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalizeFilename(slug || "memory-note");
}

function readAgentMetadataAfterRemovingLegacyField(
  raw: Record<string, unknown>,
  metadataPath: string,
) {
  try {
    const tempPath = `${metadataPath}.migration-read.tmp`;
    return readAgentMetadataFromObject(raw, tempPath);
  } catch (cause) {
    throw new MemoryPalaceError({
      kind: "invalid-note",
      message: `Could not migrate memory notes from ${metadataPath}`,
      cause,
    });
  }
}

function readAgentMetadataFromObject(raw: Record<string, unknown>, filePath: string) {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const fakeFs = {
    existsSync: () => true,
    mkdirSync: () => undefined,
    readFileSync: () => JSON.stringify(raw),
    readdirSync: () => [fileName],
    renameSync: () => undefined,
    statSync: () => ({ isDirectory: () => true }),
    writeFileSync: () => undefined,
  };
  void dir;
  return readAgentMetadata(filePath, fakeFs);
}

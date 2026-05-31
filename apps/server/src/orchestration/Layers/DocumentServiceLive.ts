import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  GoalDocument,
  GoalDocumentId,
  type CreateGoalDocumentInput,
  type GoalDocument as GoalDocumentType,
  type UpdateGoalDocumentInput,
  type WriteGoalDocumentInput,
} from "@t3tools/contracts";
import { parseFlatFrontmatter, parseFrontmatterSection } from "@t3tools/shared/frontmatter";
import { Effect, Layer, Schema } from "effect";

import { ServerConfig } from "../../config.ts";
import { DocumentServiceError } from "../Errors.ts";
import { goalDir } from "../goalFileStorage.ts";
import { DocumentService, type DocumentServiceShape } from "../Services/DocumentService.ts";

type DocumentServiceOptions = {
  readonly stateDir: string;
  readonly now?: () => string;
  readonly generateId?: () => string;
};

export function createDocumentService(options: DocumentServiceOptions): DocumentServiceShape {
  const now = options.now ?? (() => new Date().toISOString());
  const generateId = options.generateId ?? (() => randomUUID());

  const withError = <A>(operation: string, run: () => Promise<A>) =>
    Effect.tryPromise({
      try: run,
      catch: (cause) =>
        new DocumentServiceError({
          operation,
          detail: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

  const createDocument: DocumentServiceShape["createDocument"] = (input: CreateGoalDocumentInput) =>
    withError("createDocument", async () => {
      const timestamp = now();
      const document: GoalDocumentType = {
        id: GoalDocumentId.makeUnsafe(generateId()),
        goalId: input.goalId,
        title: input.title,
        content: input.content,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await writeDocumentFile(options.stateDir, document);
      return { document };
    });

  const readDocument: DocumentServiceShape["readDocument"] = (input) =>
    withError("readDocument", async () => ({
      document: await readDocumentFile(
        options.stateDir,
        input.goalId,
        input.documentId,
        input.version === undefined ? {} : { version: input.version },
      ),
    }));

  const updateDocument: DocumentServiceShape["updateDocument"] = (input: UpdateGoalDocumentInput) =>
    withError("updateDocument", async () => {
      const current = await readDocumentFile(options.stateDir, input.goalId, input.documentId);
      await writeDocumentVersionFile(options.stateDir, current);
      const document: GoalDocumentType = {
        ...current,
        ...(input.title ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        version: current.version + 1,
        updatedAt: now(),
      };
      await writeDocumentFile(options.stateDir, document);
      return { document };
    });

  const writeDocument: DocumentServiceShape["writeDocument"] = (input: WriteGoalDocumentInput) => {
    if (input.documentId) {
      return updateDocument({
        goalId: input.goalId,
        documentId: input.documentId,
        title: input.title,
        content: input.content,
      });
    }
    return createDocument(input);
  };

  const listDocumentsByGoal: DocumentServiceShape["listDocumentsByGoal"] = (input) =>
    withError("listDocumentsByGoal", async () => {
      const dir = documentsDir(options.stateDir, input.goalId);
      let entries: string[];
      try {
        entries = await fs.readdir(dir);
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === "ENOENT") return { documents: [] };
        throw cause;
      }

      const documents: GoalDocumentType[] = [];
      for (const entry of entries) {
        if (!entry.endsWith(".md")) continue;
        documents.push(await readDocumentPath(path.join(dir, entry)));
      }
      documents.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { documents };
    });

  const deleteDocument: DocumentServiceShape["deleteDocument"] = (input) =>
    withError("deleteDocument", async () => {
      await fs.rm(documentPath(options.stateDir, input.goalId, input.documentId), { force: true });
      await deleteDocumentVersions(options.stateDir, input.goalId, input.documentId);
      return {};
    });

  return {
    createDocument,
    readDocument,
    updateDocument,
    writeDocument,
    listDocumentsByGoal,
    deleteDocument,
  };
}

export const DocumentServiceLive = Layer.effect(
  DocumentService,
  Effect.gen(function* () {
    const { stateDir } = yield* ServerConfig;
    return createDocumentService({ stateDir });
  }),
);

function documentsDir(stateDir: string, goalId: string): string {
  return path.join(goalDir(stateDir, safeSegment(goalId)), "documents");
}

function documentVersionsDir(stateDir: string, goalId: string): string {
  return path.join(documentsDir(stateDir, goalId), "versions");
}

function documentPath(stateDir: string, goalId: string, documentId: string): string {
  return path.join(documentsDir(stateDir, goalId), `${safeSegment(documentId)}.md`);
}

function documentVersionPath(
  stateDir: string,
  goalId: string,
  documentId: string,
  version: number,
): string {
  return path.join(
    documentVersionsDir(stateDir, goalId),
    `${safeSegment(documentId)}.v${version}.md`,
  );
}

async function readDocumentFile(
  stateDir: string,
  goalId: string,
  documentId: string,
  options: { readonly version?: number } = {},
): Promise<GoalDocumentType> {
  if (options.version) {
    const current = await readDocumentPath(documentPath(stateDir, goalId, documentId));
    if (options.version === current.version) return current;
    return readDocumentPath(documentVersionPath(stateDir, goalId, documentId, options.version));
  }
  return readDocumentPath(documentPath(stateDir, goalId, documentId));
}

async function readDocumentPath(filePath: string): Promise<GoalDocumentType> {
  const raw = await fs.readFile(filePath, "utf8");
  const { frontmatter, body } = parseFrontmatterSection(raw);
  const fm = parseFlatFrontmatter(frontmatter);
  return Schema.decodeUnknownSync(GoalDocument)({
    id: stringField(fm.id) ?? path.basename(filePath, ".md"),
    goalId: stringField(fm.goalId),
    title: stringField(fm.title),
    content: body,
    version: Number(stringField(fm.version)),
    createdAt: stringField(fm.createdAt),
    updatedAt: stringField(fm.updatedAt),
  });
}

async function writeDocumentFile(stateDir: string, document: GoalDocumentType): Promise<void> {
  const filePath = documentPath(stateDir, document.goalId, document.id);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, serializeDocument(document), "utf8");
}

async function writeDocumentVersionFile(
  stateDir: string,
  document: GoalDocumentType,
): Promise<void> {
  const filePath = documentVersionPath(stateDir, document.goalId, document.id, document.version);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, serializeDocument(document), "utf8");
}

async function deleteDocumentVersions(
  stateDir: string,
  goalId: string,
  documentId: string,
): Promise<void> {
  const dir = documentVersionsDir(stateDir, goalId);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return;
    throw cause;
  }
  const prefix = `${safeSegment(documentId)}.v`;
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith(prefix) && entry.endsWith(".md"))
      .map((entry) => fs.rm(path.join(dir, entry), { force: true })),
  );
}

function serializeDocument(document: GoalDocumentType): string {
  const frontmatter = [
    "---",
    `id: ${document.id}`,
    `goalId: ${document.goalId}`,
    `title: ${escapeScalar(document.title)}`,
    `version: ${document.version}`,
    `createdAt: ${document.createdAt}`,
    `updatedAt: ${document.updatedAt}`,
    "---",
  ].join("\n");
  return `${frontmatter}\n\n${document.content.trim()}\n`;
}

function safeSegment(value: string): string {
  if (value.includes("/") || value.includes("\\") || value === "." || value === "..") {
    throw new Error(`Invalid path segment: ${value}`);
  }
  return value;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function escapeScalar(value: string): string {
  return /[:#[\],]/.test(value) || value.trim() !== value
    ? `"${value.replaceAll('"', '\\"')}"`
    : value;
}

import { randomUUID } from "node:crypto";
import {
  ContextNodeId,
  type ContextNode,
  type ContextBudget,
  type CreateContextNodeInput,
  type CreateContextNodeResult,
  type DeleteContextNodeInput,
  type DeleteContextNodeResult,
  type GetContextNodeInput,
  type GetContextNodeResult,
  type ListContextNodesByProjectInput,
  type ListContextNodesByProjectResult,
  type ListContextNodesByThreadInput,
  type ListContextNodesByThreadResult,
  type CompressContextNodeInput,
  type CompressContextNodeResult,
  type RestoreContextNodeInput,
  type RestoreContextNodeResult,
} from "@t3tools/contracts";
import { Effect, Layer, Option } from "effect";

import { ContextServiceError } from "../Errors.ts";
import { ContextService, type ContextServiceShape } from "../Services/ContextService.ts";
import {
  ProjectionContextNodeRepository,
  type ProjectionContextNode,
} from "../../persistence/Services/ProjectionContextNodes.ts";

function toContextNode(row: ProjectionContextNode): ContextNode {
  return {
    id: row.nodeId,
    projectId: row.projectId,
    threadId: row.threadId,
    type: row.type,
    summary: row.summary,
    size: row.size,
    compressed: row.compressed,
    createdAt: row.createdAt,
  } as ContextNode;
}

function computeBudget(nodes: ReadonlyArray<ProjectionContextNode>): ContextBudget {
  let totalSize = 0;
  let compressedSize = 0;
  for (const node of nodes) {
    totalSize += node.size;
    if (node.compressed) {
      compressedSize += node.size;
    }
  }
  const used = totalSize - compressedSize;
  const ratio = totalSize > 0 ? compressedSize / totalSize : 0;
  return {
    total: totalSize,
    used,
    available: compressedSize,
    compressionRatio: Math.round(ratio * 100) / 100,
  } as ContextBudget;
}

export const ContextServiceLive = Layer.effect(
  ContextService,
  Effect.gen(function* () {
    const repo = yield* ProjectionContextNodeRepository;

    const requireNode = (nodeId: ContextNodeId, operation: string) =>
      repo.getById({ nodeId }).pipe(
        Effect.mapError(
          (cause) => new ContextServiceError({ operation, detail: String(cause), cause }),
        ),
        Effect.flatMap((opt) =>
          Option.match(opt, {
            onNone: () =>
              Effect.fail(
                new ContextServiceError({
                  operation,
                  detail: `Context node '${nodeId}' not found.`,
                }),
              ),
            onSome: Effect.succeed,
          }),
        ),
      );

    const createContextNode: ContextServiceShape["createContextNode"] = (
      input: CreateContextNodeInput,
    ) =>
      Effect.gen(function* () {
        const nodeId = ContextNodeId.makeUnsafe(randomUUID());
        const now = new Date().toISOString();
        const row: ProjectionContextNode = {
          nodeId,
          projectId: input.projectId,
          threadId: input.threadId,
          type: input.type,
          summary: input.summary,
          size: input.size,
          compressed: false,
          createdAt: now,
        } as ProjectionContextNode;
        yield* repo.upsert(row).pipe(
          Effect.mapError(
            (cause) =>
              new ContextServiceError({
                operation: "createContextNode",
                detail: String(cause),
                cause,
              }),
          ),
        );
        return { node: toContextNode(row) } satisfies CreateContextNodeResult;
      });

    const getContextNode: ContextServiceShape["getContextNode"] = (input: GetContextNodeInput) =>
      Effect.gen(function* () {
        const row = yield* requireNode(input.id, "getContextNode");
        return { node: toContextNode(row) } satisfies GetContextNodeResult;
      });

    const listContextNodesByProject: ContextServiceShape["listContextNodesByProject"] = (
      input: ListContextNodesByProjectInput,
    ) =>
      repo.listByProjectId({ projectId: input.projectId }).pipe(
        Effect.map((rows) => ({
          nodes: rows.map(toContextNode),
          budget: computeBudget(rows),
        })),
        Effect.mapError(
          (cause) =>
            new ContextServiceError({
              operation: "listContextNodesByProject",
              detail: String(cause),
              cause,
            }),
        ),
      ) as Effect.Effect<ListContextNodesByProjectResult, ContextServiceError>;

    const listContextNodesByThread: ContextServiceShape["listContextNodesByThread"] = (
      input: ListContextNodesByThreadInput,
    ) =>
      repo.listByThreadId({ threadId: input.threadId }).pipe(
        Effect.map((rows) => ({ nodes: rows.map(toContextNode) })),
        Effect.mapError(
          (cause) =>
            new ContextServiceError({
              operation: "listContextNodesByThread",
              detail: String(cause),
              cause,
            }),
        ),
      ) as Effect.Effect<ListContextNodesByThreadResult, ContextServiceError>;

    const compressContextNode: ContextServiceShape["compressContextNode"] = (
      input: CompressContextNodeInput,
    ) =>
      Effect.gen(function* () {
        const row = yield* requireNode(input.id, "compressContextNode");
        const updated = { ...row, compressed: true } as ProjectionContextNode;
        yield* repo.upsert(updated).pipe(
          Effect.mapError(
            (cause) =>
              new ContextServiceError({
                operation: "compressContextNode",
                detail: String(cause),
                cause,
              }),
          ),
        );
        return { node: toContextNode(updated) } satisfies CompressContextNodeResult;
      });

    const restoreContextNode: ContextServiceShape["restoreContextNode"] = (
      input: RestoreContextNodeInput,
    ) =>
      Effect.gen(function* () {
        const row = yield* requireNode(input.id, "restoreContextNode");
        const updated = { ...row, compressed: false } as ProjectionContextNode;
        yield* repo.upsert(updated).pipe(
          Effect.mapError(
            (cause) =>
              new ContextServiceError({
                operation: "restoreContextNode",
                detail: String(cause),
                cause,
              }),
          ),
        );
        return { node: toContextNode(updated) } satisfies RestoreContextNodeResult;
      });

    const deleteContextNode: ContextServiceShape["deleteContextNode"] = (
      input: DeleteContextNodeInput,
    ) =>
      repo.deleteById({ nodeId: input.id }).pipe(
        Effect.map(() => ({}) satisfies DeleteContextNodeResult),
        Effect.mapError(
          (cause) =>
            new ContextServiceError({
              operation: "deleteContextNode",
              detail: String(cause),
              cause,
            }),
        ),
      );

    const getContextBudget: ContextServiceShape["getContextBudget"] = (projectId: string) =>
      repo.listByProjectId({ projectId: projectId as any }).pipe(
        Effect.map((rows) => computeBudget(rows)),
        Effect.mapError(
          (cause) =>
            new ContextServiceError({
              operation: "getContextBudget",
              detail: String(cause),
              cause,
            }),
        ),
      );

    return {
      createContextNode,
      getContextNode,
      listContextNodesByProject,
      listContextNodesByThread,
      compressContextNode,
      restoreContextNode,
      deleteContextNode,
      getContextBudget,
    } satisfies ContextServiceShape;
  }),
);

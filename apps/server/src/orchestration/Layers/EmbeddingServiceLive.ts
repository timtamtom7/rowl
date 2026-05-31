/**
 * EmbeddingServiceLive — Local semantic embeddings for deep memory search.
 *
 * Uses @xenova/transformers (Transformers.js) to run the all-MiniLM-L6-v2
 * model locally in Node.js. No API calls, no cost, no network dependency.
 *
 * The model is ~23MB, loads in seconds, and embeds text in milliseconds.
 * Embeddings are 384-dimensional float32 vectors stored in SQLite.
 *
 * Cosine similarity is used for semantic matching:
 * - "authentication" matches "login system" and "sign up flow"
 * - "database schema" matches "table structure" and "migration"
 *
 * @module EmbeddingServiceLive
 */
import { Data, Effect, Layer } from "effect";
import { ServiceMap } from "effect";

class EmbeddingServiceError extends Data.TaggedError("EmbeddingServiceError")<{
  readonly operation: string;
  readonly detail: string;
  readonly cause?: unknown;
}> {}

// ── Service interface ─────────────────────────────────────────────

export interface EmbeddingServiceShape {
  /** Generate an embedding vector for a text string */
  readonly embed: (text: string) => Effect.Effect<Float32Array, EmbeddingServiceError>;

  /** Calculate cosine similarity between two vectors (0 to 1) */
  readonly similarity: (a: Float32Array, b: Float32Array) => number;

  /** Find the most similar texts from a list of candidates */
  readonly findSimilar: (
    query: string,
    candidates: ReadonlyArray<{ id: string; text: string; embedding?: Float32Array }>,
    topK?: number,
  ) => Effect.Effect<ReadonlyArray<{ id: string; score: number }>, EmbeddingServiceError>;
}

export class EmbeddingService extends ServiceMap.Service<EmbeddingService, EmbeddingServiceShape>()(
  "rowl/orchestration/Layers/EmbeddingServiceLive/EmbeddingService",
) {}

// ── Implementation ────────────────────────────────────────────────

// Lazy-loaded pipeline
let pipelinePromise: Promise<any> | null = null;
let pipelineInstance: any = null;

async function getEmbeddingPipeline(): Promise<any> {
  if (pipelineInstance) return pipelineInstance;
  if (pipelinePromise) return pipelinePromise;

  pipelinePromise = (async () => {
    try {
      // Dynamic import to avoid loading the model at startup
      const { pipeline } = await import("@xenova/transformers");
      pipelineInstance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      return pipelineInstance;
    } catch (err) {
      pipelinePromise = null;
      throw err;
    }
  })();

  return pipelinePromise;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

export const EmbeddingServiceLive = Layer.succeed(EmbeddingService, {
  embed: (text: string) =>
    Effect.tryPromise({
      try: async () => {
        const pipe = await getEmbeddingPipeline();
        // Truncate to ~512 tokens (~2000 chars) for the model's max sequence length
        const truncated = text.slice(0, 2000);
        const output = await pipe(truncated, { pooling: "mean", normalize: true });
        // output.data is a Float32Array of the embedding
        return new Float32Array(output.data);
      },
      catch: (cause) =>
        new EmbeddingServiceError({
          operation: "embed",
          detail: "Embedding failed.",
          cause,
        }),
    }),

  similarity: cosineSimilarity,

  findSimilar: (query, candidates, topK = 5) =>
    Effect.gen(function* () {
      const pipe = yield* Effect.tryPromise({
        try: () => getEmbeddingPipeline(),
        catch: (cause) =>
          new EmbeddingServiceError({
            operation: "findSimilar",
            detail: "Embedding pipeline failed.",
            cause,
          }),
      });

      // Embed the query
      const queryTruncated = query.slice(0, 2000);
      const queryOutput = yield* Effect.tryPromise({
        try: async () => {
          const out = await pipe(queryTruncated, { pooling: "mean", normalize: true });
          return new Float32Array(out.data);
        },
        catch: (cause) =>
          new EmbeddingServiceError({
            operation: "findSimilar",
            detail: "Query embedding failed.",
            cause,
          }),
      });

      // Embed candidates that don't have pre-computed embeddings
      const results: Array<{ id: string; score: number }> = [];

      for (const candidate of candidates) {
        let candidateEmbedding = candidate.embedding;

        if (!candidateEmbedding) {
          const candTruncated = candidate.text.slice(0, 2000);
          candidateEmbedding = yield* Effect.tryPromise({
            try: async () => {
              const out = await pipe(candTruncated, { pooling: "mean", normalize: true });
              return new Float32Array(out.data);
            },
            catch: (cause) =>
              new EmbeddingServiceError({
                operation: "findSimilar",
                detail: "Candidate embedding failed.",
                cause,
              }),
          });
        }

        const score = cosineSimilarity(queryOutput, candidateEmbedding);
        results.push({ id: candidate.id, score });
      }

      // Sort by similarity, return top K
      return results.toSorted((a, b) => b.score - a.score).slice(0, topK);
    }),
} satisfies EmbeddingServiceShape);

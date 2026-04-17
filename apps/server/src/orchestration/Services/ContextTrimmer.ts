/**
 * ContextTrimmer — Service interface for surgical context trimming.
 *
 * Reduces context size by stripping tool call results (the biggest consumers)
 * while preserving conversation flow via tombstones. This is the engine
 * behind Rowl's context management — inspired by Valo's approach where
 * 80% of context weight comes from tool call results, not conversation.
 *
 * Two modes:
 * 1. Pre-send trimming: reduces the assembled context string before sending
 * 2. Conversation history trimming: for direct API providers (MiniMax),
 *    strips old tool call results from the message array
 *
 * @module ContextTrimmer
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";

export interface TrimmedMessage {
  readonly role: string;
  readonly content: string;
  readonly wasTrimmed: boolean;
  readonly originalTokens: number;
  readonly trimmedTokens: number;
}

export interface TrimResult {
  /** The trimmed content (for pre-send mode) or null (for history mode) */
  readonly trimmedContent: string | null;
  /** Number of tokens saved by trimming */
  readonly tokensSaved: number;
  /** Number of sections/messages that were trimmed */
  readonly sectionsTrimmed: number;
  /** Tombstone summaries inserted for trimmed sections */
  readonly tombstones: ReadonlyArray<string>;
}

export interface ContextTrimmerShape {
  /**
   * Trim a resume summary to a maximum token budget.
   * Keeps the most important information (current task, recent decisions).
   */
  readonly trimResumeSummary: (input: {
    readonly summary: string;
    readonly maxTokens: number;
  }) => Effect.Effect<{ trimmed: string; tokensSaved: number }>;

  /**
   * Create a tombstone message for trimmed content.
   * Tombstones preserve conversation flow by marking where content was removed.
   */
  readonly createTombstone: (input: {
    readonly originalContent: string;
    readonly reason: string;
  }) => string;

  /**
   * Trim a conversation history array (for direct API providers like MiniMax).
   * Strips tool call results from older messages, keeps recent ones intact.
   */
  readonly trimConversationHistory: (input: {
    readonly messages: ReadonlyArray<{ role: string; content: string; [key: string]: unknown }>;
    readonly keepRecentCount: number;
    readonly maxTotalTokens: number;
  }) => Effect.Effect<TrimResult>;

  /**
   * Generate an LLM-quality summary of a conversation segment.
   * Uses lightweight pattern extraction (not an actual LLM call) to produce
   * a structured summary that preserves key decisions, actions, and context.
   * This is Phase 1 — a future version will use an actual lightweight model.
   */
  readonly summarizeConversation: (input: {
    readonly messages: ReadonlyArray<{ role: string; content: string }>;
    readonly maxSummaryTokens: number;
  }) => Effect.Effect<{ summary: string; tokensSaved: number }>;
}

export class ContextTrimmer extends ServiceMap.Service<
  ContextTrimmer,
  ContextTrimmerShape
>()("rowl/orchestration/Services/ContextTrimmer") {}

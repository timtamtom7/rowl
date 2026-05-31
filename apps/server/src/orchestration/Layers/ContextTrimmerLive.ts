/**
 * ContextTrimmerLive — Surgical context trimming implementation.
 *
 * Core insight from Valo: 80% of context weight comes from tool call results
 * (file reads, code blocks, command outputs), not from the actual conversation.
 * Stripping tool results and replacing with tombstone summaries preserves
 * the conversation's meaning while freeing massive amounts of context space.
 *
 * "We keep the conversation spirit but we remove 70 to 80 to 90% of the
 * actual bloat from the context." — Valo creator
 *
 * @module ContextTrimmerLive
 */
import { Effect, Layer } from "effect";

import {
  ContextTrimmer,
  type ContextTrimmerShape,
  type TrimResult,
} from "../Services/ContextTrimmer.ts";

// ── Token estimation ─────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ── Tool call result detection ────────────────────────────────────────

// Patterns that indicate tool call results (the heavy content to trim)
const TOOL_RESULT_PATTERNS = [
  // File read results (huge — full file contents)
  /^```[\s\S]{200,}```$/m,
  // JSON tool call results
  /\{"type":"tool_result"[\s\S]*?\}/,
  // Command execution output
  /^\$\s+.*\n[\s\S]{200,}/m,
  // Diff output
  /^[+-]{3}\s+[ab]\/[\s\S]{200,}/m,
  // Large code blocks (>50 lines)
  /```\w*\n(?:.*\n){50,}```/,
];

function isLikelyToolCallResult(content: string): boolean {
  return TOOL_RESULT_PATTERNS.some((pattern) => pattern.test(content));
}

// ── Summarization (lightweight, no AI call) ───────────────────────────

function extractSummaryFromContent(content: string): string {
  // For file reads: extract the filename
  const fileMatch = content.match(/(?:Reading|Read|File|file:)\s*[`"]?([^\s`"]+)/);
  if (fileMatch) return `Read file: ${fileMatch[1]}`;

  // For command outputs: extract the command
  const cmdMatch = content.match(/^\$\s+(.+)$/m);
  if (cmdMatch) return `Ran: ${cmdMatch[1]!.slice(0, 80)}`;

  // For code blocks: count lines and detect language
  const codeMatch = content.match(/```(\w*)\n([\s\S]*?)```/);
  if (codeMatch) {
    const lang = codeMatch[1] || "code";
    const lines = (codeMatch[2] || "").split("\n").length;
    return `${lang} block (${lines} lines)`;
  }

  // For diffs: count changes
  const addedLines = (content.match(/^\+[^+]/gm) || []).length;
  const removedLines = (content.match(/^-[^-]/gm) || []).length;
  if (addedLines > 0 || removedLines > 0) {
    return `Diff: +${addedLines} -${removedLines} lines`;
  }

  // Fallback: first meaningful line, truncated
  const firstLine = content.split("\n").find((l) => l.trim().length > 10);
  return firstLine ? firstLine.trim().slice(0, 80) + "..." : "Content removed";
}

// ── Service implementation ────────────────────────────────────────────

export const ContextTrimmerLive = Layer.succeed(ContextTrimmer, {
  trimResumeSummary: (input) =>
    Effect.succeed(() => {
      const { summary, maxTokens } = input;
      const currentTokens = estimateTokens(summary);

      if (currentTokens <= maxTokens) {
        return { trimmed: summary, tokensSaved: 0 };
      }

      // Strategy: keep the first section (most recent/important context)
      // and truncate with a note
      const targetChars = maxTokens * CHARS_PER_TOKEN;
      const paragraphs = summary.split("\n\n");
      let accumulated = "";
      let includedCount = 0;

      for (const para of paragraphs) {
        if (accumulated.length + para.length + 2 > targetChars && includedCount > 0) {
          break;
        }
        accumulated += (includedCount > 0 ? "\n\n" : "") + para;
        includedCount++;
      }

      const trimmed =
        accumulated +
        `\n\n[Resume context trimmed: ${paragraphs.length - includedCount} sections removed to free context space]`;
      const tokensSaved = currentTokens - estimateTokens(trimmed);
      return { trimmed, tokensSaved: Math.max(0, tokensSaved) };
    }).pipe(Effect.map((fn) => fn())),

  createTombstone: (input) => {
    const summary = extractSummaryFromContent(input.originalContent);
    const originalTokens = estimateTokens(input.originalContent);
    return `[Trimmed: ${summary} | ${input.reason} | freed ~${originalTokens} tokens]`;
  },

  trimConversationHistory: (input) =>
    Effect.succeed(() => {
      const { messages, keepRecentCount, maxTotalTokens } = input;

      if (messages.length <= keepRecentCount) {
        return {
          trimmedContent: null,
          tokensSaved: 0,
          sectionsTrimmed: 0,
          tombstones: [],
        } satisfies TrimResult;
      }

      let totalTokens = 0;
      for (const msg of messages) {
        totalTokens += estimateTokens(
          typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        );
      }

      if (totalTokens <= maxTotalTokens) {
        return {
          trimmedContent: null,
          tokensSaved: 0,
          sectionsTrimmed: 0,
          tombstones: [],
        } satisfies TrimResult;
      }

      // Trim older messages first, keep recent ones intact
      const oldMessages = messages.slice(0, messages.length - keepRecentCount);
      let tokensSaved = 0;
      let sectionsTrimmed = 0;
      const tombstones: string[] = [];

      for (const msg of oldMessages) {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

        if (isLikelyToolCallResult(content) && estimateTokens(content) > 100) {
          const summary = extractSummaryFromContent(content);
          const saved = estimateTokens(content) - estimateTokens(summary);
          tokensSaved += saved;
          sectionsTrimmed++;
          tombstones.push(`[Trimmed from ${msg.role}: ${summary}]`);
        }
      }

      return {
        trimmedContent: null,
        tokensSaved,
        sectionsTrimmed,
        tombstones,
      } satisfies TrimResult;
    }).pipe(Effect.map((fn) => fn())),
  summarizeConversation: (input) =>
    Effect.succeed(() => {
      const { messages, maxSummaryTokens } = input;
      const maxChars = maxSummaryTokens * CHARS_PER_TOKEN;

      // Extract structured information from the conversation
      const sections: string[] = [];

      // 1. Extract user requests
      const userMessages = messages.filter((m) => m.role === "user");
      const userRequests = userMessages
        .map((m) => m.content.slice(0, 150).replace(/\n/g, " ").trim())
        .filter((t) => t.length > 10);
      if (userRequests.length > 0) {
        sections.push("User asked: " + userRequests.slice(-3).join("; "));
      }

      // 2. Extract AI decisions and actions
      const assistantMessages = messages.filter((m) => m.role === "assistant");
      const decisions: string[] = [];
      const actions: string[] = [];

      for (const msg of assistantMessages) {
        const text = msg.content;

        // Extract decisions
        const decisionMatch = text.match(
          /(?:I (?:chose|decided|went with|used|created|built|implemented))\s+(.{20,100})/i,
        );
        if (decisionMatch?.[1]) decisions.push(decisionMatch[1].trim());

        // Extract file operations
        const fileMatches = text.matchAll(
          /(?:created|modified|updated|deleted|wrote|edited)\s+(?:the\s+)?(?:file\s+)?[`"]?([^\s`"]+\.\w+)/gi,
        );
        for (const m of fileMatches) {
          if (m[1]) actions.push(m[1]);
        }
      }

      if (decisions.length > 0) {
        sections.push("Decisions: " + decisions.slice(-5).join("; "));
      }
      if (actions.length > 0) {
        const uniqueActions = [...new Set(actions)];
        sections.push("Files touched: " + uniqueActions.slice(-10).join(", "));
      }

      // 3. Count turns
      sections.push(
        `Conversation: ${userMessages.length} user messages, ${assistantMessages.length} assistant responses`,
      );

      let summary = sections.join("\n");
      if (summary.length > maxChars) {
        summary = summary.slice(0, maxChars - 20) + "\n[summary truncated]";
      }

      const originalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
      const summaryTokens = estimateTokens(summary);

      return {
        summary,
        tokensSaved: Math.max(0, originalTokens - summaryTokens),
      };
    }).pipe(Effect.map((fn) => fn())),
} satisfies ContextTrimmerShape);

import { describe, it, expect } from "vitest";
import { Effect, Layer } from "effect";
import { ContextTrimmerLive } from "./ContextTrimmerLive";
import { ContextTrimmer } from "../Services/ContextTrimmer";

const testLayer = ContextTrimmerLive;

const run = <A>(fn: (trimmer: ContextTrimmer) => Effect.Effect<A>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const trimmer = yield* ContextTrimmer;
      return yield* fn(trimmer);
    }).pipe(Effect.provide(testLayer)),
  );

describe("ContextTrimmerLive", () => {
  describe("trimResumeSummary", () => {
    it("passes through short summaries unchanged", async () => {
      const result = await run((t) =>
        t.trimResumeSummary({ summary: "Short summary", maxTokens: 100 }),
      );
      expect(result.trimmed).toBe("Short summary");
      expect(result.tokensSaved).toBe(0);
    });

    it("truncates long summaries beyond token budget", async () => {
      const longSummary = Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1} with some content here.`).join("\n\n");
      const result = await run((t) =>
        t.trimResumeSummary({ summary: longSummary, maxTokens: 20 }),
      );
      expect(result.trimmed.length).toBeLessThan(longSummary.length);
      expect(result.trimmed).toContain("[Resume context trimmed");
    });
  });

  describe("createTombstone", () => {
    it("creates tombstone for file content", async () => {
      const tombstone = await run((t) =>
        Effect.succeed(t.createTombstone({
          originalContent: "Reading file: src/App.tsx\n```\nimport React from 'react';\n" + "x\n".repeat(100) + "```",
          reason: "context trimming",
        })),
      );
      expect(tombstone).toContain("[Trimmed:");
      expect(tombstone).toContain("context trimming");
    });

    it("creates tombstone for command output", async () => {
      const tombstone = await run((t) =>
        Effect.succeed(t.createTombstone({
          originalContent: "$ npm run build\n" + "output line\n".repeat(50),
          reason: "old turn",
        })),
      );
      expect(tombstone).toContain("[Trimmed:");
      expect(tombstone).toContain("Ran:");
    });
  });

  describe("summarizeConversation", () => {
    it("extracts user requests", async () => {
      const result = await run((t) =>
        t.summarizeConversation({
          messages: [
            { role: "user", content: "Build me a login page with email and password fields" },
            { role: "assistant", content: "I created the login component." },
          ],
          maxSummaryTokens: 200,
        }),
      );
      expect(result.summary).toContain("User asked:");
    });

    it("extracts file operations from assistant messages", async () => {
      const result = await run((t) =>
        t.summarizeConversation({
          messages: [
            { role: "user", content: "Add authentication" },
            { role: "assistant", content: "I created auth.ts and modified App.tsx" },
          ],
          maxSummaryTokens: 200,
        }),
      );
      expect(result.summary).toContain("Files touched:");
    });

    it("counts conversation turns", async () => {
      const result = await run((t) =>
        t.summarizeConversation({
          messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi" },
            { role: "user", content: "Build X" },
            { role: "assistant", content: "Done" },
          ],
          maxSummaryTokens: 200,
        }),
      );
      expect(result.summary).toContain("2 user messages");
      expect(result.summary).toContain("2 assistant responses");
    });
  });
});

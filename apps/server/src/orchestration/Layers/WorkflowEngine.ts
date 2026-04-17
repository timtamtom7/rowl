/**
 * WorkflowEngine — Harness-based workflow instructions for AI agents.
 *
 * The evolution: Prompt Engineering → Context Engineering → Harness Engineering.
 * A harness is the complete operational environment: instructions + tools +
 * feedback + control. This engine manages the instruction layer.
 *
 * Three instruction scopes:
 * 1. Global prompts — user preferences, coding style (from project_prompts table)
 * 2. Project prompts — tech stack, conventions (from project_prompts table)
 * 3. Workflow instructions — contextual workflows based on task type
 *
 * Workflow detection suggests a harness; the user confirms or picks a different one.
 * Harnesses are NOT force-injected — they're activated by the user or the PM.
 *
 * Built-in harnesses:
 * - Careful Builder (superpowers-style: brainstorm → plan → build → verify)
 * - Fast Prototyper (just build it, iterate)
 * - Systematic Debugger (reproduce → hypothesize → trace → fix → verify)
 * - Code Reviewer (checklist with severity levels)
 * - Refactorer (restructure with test safety net)
 *
 * @module WorkflowEngine
 */
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { Effect } from "effect";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

// ── Workflow detection (for suggestions) ──────────────────────────

export type WorkflowType =
  | "planning"
  | "implementation"
  | "debugging"
  | "review"
  | "verification";

const WORKFLOW_TRIGGERS: Array<{
  patterns: RegExp[];
  workflow: WorkflowType;
  suggestion: string;
}> = [
  {
    patterns: [
      /(?:build|create|make|implement|add|develop|set up)\s+(?:a |the |my )?/i,
      /(?:I want|let's|can you|please)\s+(?:build|create|make|add)/i,
    ],
    workflow: "planning",
    suggestion: "Use the Careful Builder harness? (brainstorm → plan → build → verify)",
  },
  {
    patterns: [
      /(?:fix|debug|solve|resolve|investigate|why (?:is|does|isn't|doesn't))/i,
      /(?:broken|not working|bug|error|crash|failing)/i,
    ],
    workflow: "debugging",
    suggestion: "Use the Systematic Debugger harness? (reproduce → trace → fix → verify)",
  },
  {
    patterns: [
      /(?:review|check|audit|look at|examine)/i,
      /(?:code review|pull request|PR)/i,
    ],
    workflow: "review",
    suggestion: "Use the Code Reviewer harness? (checklist with severity levels)",
  },
];

export function detectWorkflow(userMessage: string): {
  workflow: WorkflowType;
  suggestion: string;
} | null {
  for (const { patterns, workflow, suggestion } of WORKFLOW_TRIGGERS) {
    for (const pattern of patterns) {
      if (pattern.test(userMessage)) return { workflow, suggestion };
    }
  }
  return null;
}

// ── Built-in harness definitions ────────────────────────────────

export const BUILTIN_HARNESSES: Record<string, {
  name: string;
  description: string;
  category: string;
  content: string;
}> = {
  "careful-builder": {
    name: "Careful Builder",
    description: "Brainstorm → plan → build → verify. Best for new features.",
    category: "building",
    content: `<harness name="careful-builder">
WORKFLOW: Brainstorm → Plan → Build → Verify

PHASE 1 - UNDERSTAND:
- Ask 2-3 clarifying questions about what the user wants
- Don't assume — verify requirements
- Propose your approach in plain language

PHASE 2 - PLAN:
- Break the work into small, testable steps
- List files you'll create or modify
- Identify dependencies between steps
- Get user confirmation before coding

PHASE 3 - BUILD:
- Work one step at a time
- Each step should compile and ideally be testable
- Describe what you did after each step
- If unsure about an approach, say so

PHASE 4 - VERIFY:
- Run build/typecheck and report results
- Describe exactly what changed
- Tell the user what to test
- List any known limitations
- Never claim done without evidence
</harness>`,
  },

  "fast-prototyper": {
    name: "Fast Prototyper",
    description: "Just build it, iterate quickly. Best for exploration.",
    category: "building",
    content: `<harness name="fast-prototyper">
WORKFLOW: Build → Show → Iterate

- Jump straight into building
- Prioritize getting something working over perfection
- Show progress frequently
- Iterate based on feedback
- Skip tests for now — focus on the experience
- Note what needs hardening later
</harness>`,
  },

  "systematic-debugger": {
    name: "Systematic Debugger",
    description: "Reproduce → trace → fix → verify. Best for bugs.",
    category: "debugging",
    content: `<harness name="systematic-debugger">
WORKFLOW: Reproduce → Hypothesize → Trace → Fix → Verify

1. REPRODUCE: Understand the exact failure. What happens? What should happen?
2. HYPOTHESIZE: Form a specific theory. "I think X is causing Y because Z."
3. TRACE: Follow the code from input to failure point. Read the actual code, don't guess.
4. FIX: Make the MINIMAL change that fixes the root cause. Not a workaround.
5. VERIFY: Confirm the fix works AND didn't break anything else.

DO NOT:
- Guess and apply random fixes
- Change multiple things at once
- Skip reproduction
- Ignore root cause and patch symptoms
- Say "should work now" without testing
</harness>`,
  },

  "code-reviewer": {
    name: "Code Reviewer",
    description: "Thorough review with severity levels. Best for quality checks.",
    category: "review",
    content: `<harness name="code-reviewer">
REVIEW CHECKLIST:

1. REQUIREMENTS: Does code match stated requirements? Check every one.
2. EDGE CASES: Empty inputs, errors, loading states, race conditions?
3. QUALITY: Clean naming, no duplication, maintainable structure?
4. SECURITY: Injection, auth bypass, data exposure?
5. PERFORMANCE: Unnecessary renders, N+1 queries, unbounded loops?

Report by severity:
- CRITICAL: Will break in production
- HIGH: Significant bug or security issue
- MEDIUM: Code quality or maintainability concern
- LOW: Style or minor improvement
</harness>`,
  },

  "refactorer": {
    name: "Refactorer",
    description: "Restructure safely with tests. Best for cleanup.",
    category: "refactoring",
    content: `<harness name="refactorer">
WORKFLOW: Test → Restructure → Verify

1. First, ensure tests exist for the code being refactored
2. If no tests, write them BEFORE refactoring
3. Make one structural change at a time
4. Run tests after each change
5. If tests break, revert and try a different approach
6. Never change behavior — only structure
7. Document what changed and why
</harness>`,
  },
};

// ── Project prompt retrieval ────────────────────────────────────

/**
 * Build the complete instruction block from project prompts + active harness.
 * This gets injected into the AI turn context.
 */
export function buildProjectPromptsBlock(
  prompts: ReadonlyArray<{
    scope: string;
    name: string;
    content: string;
    enabled: boolean;
  }>,
  activeHarnessContent: string | null,
): string | null {
  const parts: string[] = [];

  // Add enabled project prompts
  const enabledPrompts = prompts.filter((p) => p.enabled);
  if (enabledPrompts.length > 0) {
    parts.push("<project_rules>");
    for (const prompt of enabledPrompts) {
      parts.push(`<rule name="${prompt.name}" scope="${prompt.scope}">`);
      parts.push(prompt.content);
      parts.push("</rule>");
    }
    parts.push("</project_rules>");
  }

  // Add active harness
  if (activeHarnessContent) {
    parts.push(activeHarnessContent);
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

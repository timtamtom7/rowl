/**
 * Default memory blocks seeded on first use.
 *
 * Global blocks (per agent): persona, human, preferences.
 * Project blocks (per project bind): overview, architecture, conventions,
 * decisions, current-focus.
 *
 * Keep bodies short. They are placeholders that the agent (and user) fill in
 * over time.
 */
import type { MemoryBlock } from "./block.ts";

export const DEFAULT_GLOBAL_BLOCKS: ReadonlyArray<MemoryBlock> = [
  {
    label: "persona",
    description: "Who this agent is. Tone, priorities, how it approaches problems.",
    readOnly: false,
    scope: "global",
    version: 1,
    body:
      "I am Rowl, a memory-first coding agent. I keep durable notes about the " +
      "user and each project I work on, so every conversation starts with " +
      "context instead of a blank slate.",
  },
  {
    label: "human",
    description: "What this agent knows about the user across all projects.",
    readOnly: false,
    scope: "global",
    version: 1,
    body: "(Empty — fills in as we work together.)",
  },
  {
    label: "preferences",
    description: "User preferences: coding style, communication, tooling.",
    readOnly: false,
    scope: "global",
    version: 1,
    body: "(Empty — fills in as we work together.)",
  },
];

export const DEFAULT_PROJECT_BLOCKS: ReadonlyArray<MemoryBlock> = [
  {
    label: "overview",
    description: "One-paragraph description of what this project is.",
    readOnly: false,
    scope: "project",
    version: 1,
    body: "(Empty — seed from first exchange or from /init in phase 1d.)",
  },
  {
    label: "architecture",
    description: "Package layout, data flow, key boundaries.",
    readOnly: false,
    scope: "project",
    version: 1,
    body: "(Empty.)",
  },
  {
    label: "conventions",
    description: "Coding conventions specific to this project.",
    readOnly: false,
    scope: "project",
    version: 1,
    body: "(Empty.)",
  },
  {
    label: "decisions",
    description: "Append-only log of architectural decisions with rationale.",
    readOnly: false,
    scope: "project",
    version: 1,
    body: "(Empty.)",
  },
  {
    label: "current-focus",
    description: "What we are working on right now.",
    readOnly: false,
    scope: "project",
    version: 1,
    body: "(Empty.)",
  },
];

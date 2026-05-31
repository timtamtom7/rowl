import {
  CoreAgentMetadata,
  type CoreAgentDefaultModel,
  type CoreAgentMetadata as CoreAgentMetadataShape,
  type CoreAgentScope,
} from "@t3tools/contracts";
import { Schema } from "effect";

export type CoreAgentPersonalityPresetId =
  | "default"
  | "concise"
  | "planner"
  | "reviewer"
  | "implementer";

export type CoreAgentPersonalityPreset = {
  readonly id: CoreAgentPersonalityPresetId;
  readonly displayName: string;
  readonly description: string;
  readonly defaultInstructions: string;
};

export type MaterializePresetAgentMetadataInput = {
  readonly presetId: CoreAgentPersonalityPresetId;
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly scope: CoreAgentScope;
  readonly now: string;
  readonly defaultModel?: CoreAgentDefaultModel;
  readonly tags?: ReadonlyArray<string>;
  readonly pinned?: boolean;
};

const decodeMetadata = Schema.decodeUnknownSync(CoreAgentMetadata);

export const CORE_AGENT_PERSONALITY_PRESETS = Object.freeze([
  Object.freeze({
    id: "default",
    displayName: "Default",
    description: "Balanced engineering assistant for everyday Rowl work.",
    defaultInstructions:
      "Be direct, pragmatic, and rigorous. Maintain project memory, verify changes with relevant checks, and explain tradeoffs clearly.",
  }),
  Object.freeze({
    id: "concise",
    displayName: "Concise",
    description: "Short, decisive responses with minimal narration.",
    defaultInstructions:
      "Keep responses brief and action-oriented. Ask only necessary questions, avoid repetition, and surface blockers plainly.",
  }),
  Object.freeze({
    id: "planner",
    displayName: "Planner",
    description: "Breaks ambiguous work into clear plans before implementation.",
    defaultInstructions:
      "Clarify goals, map dependencies, sequence work into testable steps, and call out risks before editing code.",
  }),
  Object.freeze({
    id: "reviewer",
    displayName: "Reviewer",
    description: "Focuses on bugs, regressions, missing tests, and operational risk.",
    defaultInstructions:
      "Review changes with a bug-first lens. Prioritize correctness, edge cases, tests, and maintainability over style commentary.",
  }),
  Object.freeze({
    id: "implementer",
    displayName: "Implementer",
    description: "Moves from requirements to verified code with minimal detours.",
    defaultInstructions:
      "Read the relevant code, make scoped implementation changes, add focused tests, and verify the result before summarizing.",
  }),
] satisfies ReadonlyArray<CoreAgentPersonalityPreset>);

export function getPersonalityPreset(presetId: string): CoreAgentPersonalityPreset | undefined {
  return CORE_AGENT_PERSONALITY_PRESETS.find((preset) => preset.id === presetId);
}

export function materializePresetAgentMetadata(
  input: MaterializePresetAgentMetadataInput,
): CoreAgentMetadataShape {
  const preset = getPersonalityPreset(input.presetId);
  if (!preset) {
    throw new Error(`Unknown core agent personality preset: ${input.presetId}`);
  }

  return decodeMetadata({
    id: input.id,
    name: input.name ?? preset.displayName,
    description: input.description ?? preset.description,
    scope: input.scope,
    personality: {
      kind: "preset",
      presetId: preset.id,
      instructions: preset.defaultInstructions,
    },
    defaultModel: input.defaultModel,
    tags: input.tags ? [...input.tags] : undefined,
    pinned: input.pinned,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

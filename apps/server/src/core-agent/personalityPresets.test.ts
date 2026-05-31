import type { CoreAgentMetadata } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  CORE_AGENT_PERSONALITY_PRESETS,
  getPersonalityPreset,
  materializePresetAgentMetadata,
} from "./personalityPresets.ts";

describe("CORE_AGENT_PERSONALITY_PRESETS", () => {
  it("ships the built-in preset catalog", () => {
    expect(CORE_AGENT_PERSONALITY_PRESETS.map((preset) => preset.id)).toEqual([
      "default",
      "concise",
      "planner",
      "reviewer",
      "implementer",
    ]);

    for (const preset of CORE_AGENT_PERSONALITY_PRESETS) {
      expect(preset.displayName).not.toBe("");
      expect(preset.description).not.toBe("");
      expect(preset.defaultInstructions).not.toBe("");
    }
  });

  it("freezes preset definitions so callers cannot mutate the shared catalog", () => {
    expect(Object.isFrozen(CORE_AGENT_PERSONALITY_PRESETS)).toBe(true);
    expect(CORE_AGENT_PERSONALITY_PRESETS.every((preset) => Object.isFrozen(preset))).toBe(true);

    expect(() => {
      (CORE_AGENT_PERSONALITY_PRESETS as unknown as Array<unknown>).push({
        id: "mutable",
      });
    }).toThrow(TypeError);

    const defaultPreset = getPersonalityPreset("default");
    expect(defaultPreset).toBeDefined();
    expect(() => {
      (defaultPreset as { displayName: string }).displayName = "Changed";
    }).toThrow(TypeError);
    expect(getPersonalityPreset("default")?.displayName).toBe("Default");
  });
});

describe("materializePresetAgentMetadata", () => {
  it("materializes a preset into editable core agent metadata", () => {
    const metadata = materializePresetAgentMetadata({
      presetId: "reviewer",
      id: "reviewer-1",
      scope: { type: "project", projectRoot: "/tmp/project" },
      now: "2026-05-29T12:00:00.000Z",
    });

    expect(metadata).toMatchObject<CoreAgentMetadata>({
      id: "reviewer-1",
      name: "Reviewer",
      description: getPersonalityPreset("reviewer")?.description,
      scope: { type: "project", projectRoot: "/tmp/project" },
      personality: {
        kind: "preset",
        presetId: "reviewer",
        instructions: getPersonalityPreset("reviewer")?.defaultInstructions ?? "",
      },
      createdAt: "2026-05-29T12:00:00.000Z",
      updatedAt: "2026-05-29T12:00:00.000Z",
    });

    const editableMetadata = metadata as {
      name: string;
      personality: { instructions: string };
    };
    editableMetadata.name = "Review Lead";
    editableMetadata.personality.instructions = "Focus on regressions and missing tests.";

    expect(metadata.name).toBe("Review Lead");
    expect(getPersonalityPreset("reviewer")?.displayName).toBe("Reviewer");
    expect(getPersonalityPreset("reviewer")?.defaultInstructions).not.toBe(
      "Focus on regressions and missing tests.",
    );
  });

  it("allows callers to override editable metadata fields without mutating the preset", () => {
    const metadata = materializePresetAgentMetadata({
      presetId: "planner",
      id: "planner-1",
      name: "Roadmap Planner",
      description: "Project planning specialist",
      scope: { type: "global" },
      now: "2026-05-29T12:00:00.000Z",
      tags: ["planning"],
      pinned: true,
    });

    expect(metadata).toMatchObject({
      id: "planner-1",
      name: "Roadmap Planner",
      description: "Project planning specialist",
      tags: ["planning"],
      pinned: true,
      personality: {
        kind: "preset",
        presetId: "planner",
        instructions: getPersonalityPreset("planner")?.defaultInstructions,
      },
    });
    expect(getPersonalityPreset("planner")?.displayName).toBe("Planner");
  });
});

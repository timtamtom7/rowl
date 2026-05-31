import { describe, it, expect } from "vitest";
import { detectWorkflow, BUILTIN_HARNESSES, buildProjectPromptsBlock } from "./WorkflowEngine";

describe("WorkflowEngine", () => {
  describe("detectWorkflow", () => {
    it("detects planning/building intent", () => {
      expect(detectWorkflow("Build me a login page")?.workflow).toBe("planning");
      expect(detectWorkflow("Create a new component for the dashboard")?.workflow).toBe("planning");
      expect(detectWorkflow("I want to add authentication")?.workflow).toBe("planning");
      expect(detectWorkflow("Let's build the shopping cart")?.workflow).toBe("planning");
      expect(detectWorkflow("Can you implement user profiles?")?.workflow).toBe("planning");
    });

    it("detects debugging intent", () => {
      expect(detectWorkflow("Fix the login bug")?.workflow).toBe("debugging");
      expect(detectWorkflow("The cart is broken")?.workflow).toBe("debugging");
      expect(detectWorkflow("Debug this error in the API")?.workflow).toBe("debugging");
      expect(detectWorkflow("Why isn't the button working?")?.workflow).toBe("debugging");
      expect(detectWorkflow("Investigate the crash on page load")?.workflow).toBe("debugging");
    });

    it("detects review intent", () => {
      expect(detectWorkflow("Review the changes I made")?.workflow).toBe("review");
      expect(detectWorkflow("Check this code for issues")?.workflow).toBe("review");
      expect(detectWorkflow("Audit the security of the auth module")?.workflow).toBe("review");
    });

    it("returns null for ambiguous messages", () => {
      expect(detectWorkflow("Hello")).toBe(null);
      expect(detectWorkflow("What's the weather?")).toBe(null);
      expect(detectWorkflow("Thanks!")).toBe(null);
    });
  });

  describe("BUILTIN_HARNESSES", () => {
    it("has 5 built-in harnesses", () => {
      expect(Object.keys(BUILTIN_HARNESSES)).toHaveLength(5);
    });

    it("each harness has required fields", () => {
      for (const [id, harness] of Object.entries(BUILTIN_HARNESSES)) {
        expect(harness.name).toBeTruthy();
        expect(harness.description).toBeTruthy();
        expect(harness.category).toBeTruthy();
        expect(harness.content).toContain("<harness");
        expect(harness.content).toContain("</harness>");
      }
    });

    it("has careful-builder harness", () => {
      expect(BUILTIN_HARNESSES["careful-builder"]).toBeDefined();
      expect(BUILTIN_HARNESSES["careful-builder"]!.content).toContain("PHASE 1");
      expect(BUILTIN_HARNESSES["careful-builder"]!.content).toContain("VERIFY");
    });

    it("has systematic-debugger harness", () => {
      expect(BUILTIN_HARNESSES["systematic-debugger"]).toBeDefined();
      expect(BUILTIN_HARNESSES["systematic-debugger"]!.content).toContain("REPRODUCE");
      expect(BUILTIN_HARNESSES["systematic-debugger"]!.content).toContain("TRACE");
    });
  });

  describe("buildProjectPromptsBlock", () => {
    it("returns null for empty inputs", () => {
      expect(buildProjectPromptsBlock([], null)).toBe(null);
    });

    it("builds XML from enabled prompts", () => {
      const result = buildProjectPromptsBlock(
        [
          {
            scope: "project",
            name: "Use TypeScript",
            content: "Always use TypeScript.",
            enabled: true,
          },
        ],
        null,
      );
      expect(result).toContain("<project_rules>");
      expect(result).toContain("Use TypeScript");
      expect(result).toContain("Always use TypeScript.");
      expect(result).toContain("</project_rules>");
    });

    it("skips disabled prompts", () => {
      const result = buildProjectPromptsBlock(
        [
          {
            scope: "project",
            name: "Disabled Rule",
            content: "Should not appear.",
            enabled: false,
          },
        ],
        null,
      );
      expect(result).toBe(null);
    });

    it("includes harness content when provided", () => {
      const result = buildProjectPromptsBlock([], '<harness name="test">Do the thing.</harness>');
      expect(result).toContain("<harness");
      expect(result).toContain("Do the thing.");
    });

    it("combines prompts and harness", () => {
      const result = buildProjectPromptsBlock(
        [{ scope: "global", name: "Global Rule", content: "Be helpful.", enabled: true }],
        '<harness name="careful">Be careful.</harness>',
      );
      expect(result).toContain("<project_rules>");
      expect(result).toContain("Global Rule");
      expect(result).toContain("<harness");
    });
  });
});

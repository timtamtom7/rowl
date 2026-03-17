import { describe, expect, it } from "vitest";

import {
  clearProjectScriptValidationFields,
  getFirstInvalidProjectScriptField,
  validateProjectScriptInput,
} from "./ProjectScriptsControl.logic";

describe("validateProjectScriptInput", () => {
  it("returns a name error when the name is blank", () => {
    expect(
      validateProjectScriptInput({
        name: "   ",
        command: "bun test",
      }),
    ).toEqual({ name: "Name is required." });
  });

  it("returns a command error when the command is blank", () => {
    expect(
      validateProjectScriptInput({
        name: "Test",
        command: "   ",
      }),
    ).toEqual({ command: "Command is required." });
  });

  it("returns both errors when both required fields are blank", () => {
    expect(
      validateProjectScriptInput({
        name: "   ",
        command: "   ",
      }),
    ).toEqual({
      name: "Name is required.",
      command: "Command is required.",
    });
  });

  it("returns no field errors for valid trimmed input", () => {
    expect(
      validateProjectScriptInput({
        name: "  Test  ",
        command: "  bun test  ",
      }),
    ).toEqual({});
  });
});

describe("getFirstInvalidProjectScriptField", () => {
  it("prefers the name field when both fields are invalid", () => {
    expect(
      getFirstInvalidProjectScriptField({
        name: "Name is required.",
        command: "Command is required.",
      }),
    ).toBe("name");
  });

  it("returns the command field when only the command is invalid", () => {
    expect(
      getFirstInvalidProjectScriptField({
        command: "Command is required.",
      }),
    ).toBe("command");
  });

  it("returns null when no field errors are present", () => {
    expect(getFirstInvalidProjectScriptField({ form: "Failed to save action." })).toBeNull();
  });
});

describe("clearProjectScriptValidationFields", () => {
  it("clears only the requested fields", () => {
    expect(
      clearProjectScriptValidationFields(
        {
          name: "Name is required.",
          command: "Command is required.",
          form: "Failed to save action.",
        },
        ["name", "form"],
      ),
    ).toEqual({ command: "Command is required." });
  });

  it("returns the original object when nothing changes", () => {
    const errors = { command: "Command is required." };
    expect(clearProjectScriptValidationFields(errors, ["name"])).toBe(errors);
  });
});

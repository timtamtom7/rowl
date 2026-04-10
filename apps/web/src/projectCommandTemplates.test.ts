import { describe, expect, it } from "vitest";

import type { ProjectCommandTemplate } from "@t3tools/contracts";

import {
  expandProjectCommandTemplate,
  resolveProjectCommandTemplate,
} from "./projectCommandTemplates";

const DEPLOY_TEMPLATE: ProjectCommandTemplate = {
  name: "deploy",
  relativePath: ".rowl/commands/deploy.md",
  description: "Deploy the selected target",
  template: "Deploy $1 with notes: $ARGUMENTS",
  provider: "codex",
  model: "gpt-5-codex",
  interactionMode: "default",
  runtimeMode: "approval-required",
  sendImmediately: true,
};

describe("resolveProjectCommandTemplate", () => {
  it("matches command names case-insensitively", () => {
    expect(resolveProjectCommandTemplate([DEPLOY_TEMPLATE], "DEPLOY")).toEqual(DEPLOY_TEMPLATE);
  });
});

describe("expandProjectCommandTemplate", () => {
  it("expands positional and full-argument placeholders and exposes overrides", () => {
    expect(
      expandProjectCommandTemplate({
        template: DEPLOY_TEMPLATE,
        argumentsText: "production with migrations",
      }),
    ).toEqual({
      template: DEPLOY_TEMPLATE,
      text: "Deploy production with notes: production with migrations",
      sendImmediately: true,
      overrides: {
        provider: "codex",
        model: "gpt-5-codex",
        interactionMode: "default",
        runtimeMode: "approval-required",
      },
    });
  });
});

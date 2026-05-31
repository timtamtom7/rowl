import { describe, it, expect } from "vitest";
import {
  parseFrontmatterSection,
  parseFlatFrontmatter,
  parseFrontmatterValue,
} from "./frontmatter";

describe("parseFrontmatterSection", () => {
  it("splits a document with frontmatter and body", () => {
    const raw = "---\nfoo: bar\n---\nbody text";
    expect(parseFrontmatterSection(raw)).toEqual({
      frontmatter: "foo: bar",
      body: "body text",
    });
  });

  it("throws when frontmatter is not closed", () => {
    expect(() => parseFrontmatterSection("---\nfoo: bar\n")).toThrow(
      "Frontmatter is missing a closing --- line.",
    );
  });

  it("throws when document does not start with ---", () => {
    expect(() => parseFrontmatterSection("foo: bar")).toThrow(
      "Expected YAML frontmatter fenced by ---.",
    );
  });
});

describe("parseFrontmatterValue", () => {
  it("parses true/false to booleans", () => {
    expect(parseFrontmatterValue("true")).toBe(true);
    expect(parseFrontmatterValue("false")).toBe(false);
  });

  it("strips matching quotes", () => {
    expect(parseFrontmatterValue('"hello"')).toBe("hello");
    expect(parseFrontmatterValue("'hi'")).toBe("hi");
  });

  it("trims unquoted strings", () => {
    expect(parseFrontmatterValue("  abc  ")).toBe("abc");
  });
});

describe("parseFlatFrontmatter", () => {
  it("parses a flat key-value block", () => {
    const result = parseFlatFrontmatter("label: architecture\nread_only: true");
    expect(result).toEqual({ label: "architecture", read_only: true });
  });

  it("skips blank lines and comments", () => {
    const result = parseFlatFrontmatter("\n# a comment\nfoo: bar\n");
    expect(result).toEqual({ foo: "bar" });
  });

  it("throws on malformed lines", () => {
    expect(() => parseFlatFrontmatter("not a pair")).toThrow(
      "Invalid frontmatter line 'not a pair'.",
    );
  });
});

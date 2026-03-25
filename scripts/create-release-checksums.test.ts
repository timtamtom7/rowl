import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { assert, describe, it } from "@effect/vitest";

import {
  createReleaseChecksums,
  serializeReleaseChecksums,
  writeReleaseChecksums,
} from "./create-release-checksums.ts";

describe("create-release-checksums", () => {
  it("writes stable SHA256SUMS entries for release assets", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "cut3-release-checksums-"));

    try {
      writeFileSync(resolve(rootDir, "CUT3-linux-1.0.0-x86_64.AppImage"), "linux-app");
      writeFileSync(resolve(rootDir, "latest.yml"), "channel-manifest");
      mkdirSync(resolve(rootDir, "nested"), { recursive: true });
      writeFileSync(resolve(rootDir, "nested", "CUT3-macOS-1.0.0-arm64.zip"), "mac-zip");
      writeFileSync(resolve(rootDir, "SHA256SUMS"), "stale-manifest");

      const entries = createReleaseChecksums(rootDir);
      assert.deepStrictEqual(
        entries.map((entry) => entry.path),
        ["CUT3-linux-1.0.0-x86_64.AppImage", "latest.yml", "nested/CUT3-macOS-1.0.0-arm64.zip"],
      );

      const serialized = serializeReleaseChecksums(entries);
      assert.equal(serialized.split("\n").length, 3);
      assert.ok(serialized.includes("CUT3-linux-1.0.0-x86_64.AppImage"));
      assert.ok(serialized.includes("nested/CUT3-macOS-1.0.0-arm64.zip"));

      const outputPath = writeReleaseChecksums(rootDir);
      const written = readFileSync(outputPath, "utf8");
      assert.equal(written, `${serialized}\n`);
      assert.ok(!written.includes("stale-manifest"));
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

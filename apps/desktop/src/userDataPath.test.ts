import { describe, expect, it } from "vitest";

import { getLegacyUserDataDirNames, resolveDesktopUserDataPath } from "./userDataPath";

describe("getLegacyUserDataDirNames", () => {
  it("keeps the unified CUT3 profile compatible with legacy T3 directories", () => {
    expect(getLegacyUserDataDirNames({ appDisplayName: "CUT3" })).toEqual([
      "CUT3",
      "T3 Code",
      "T3 Code (Alpha)",
      "T3 Code (Dev)",
    ]);
  });
});

describe("resolveDesktopUserDataPath", () => {
  it("prefers an existing legacy stable dir over the clean userData dir", () => {
    const existingPaths = new Set(["/config/CUT3"]);

    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "cut3",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "CUT3" }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/CUT3");
  });

  it("falls back to the clean userData dir when no legacy dir exists", () => {
    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "cut3",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "CUT3" }),
        pathExists: () => false,
      }),
    ).toBe("/config/cut3");
  });

  it("can recover the old alpha directory too", () => {
    const existingPaths = new Set(["/config/T3 Code (Alpha)"]);

    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "cut3",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "CUT3" }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/T3 Code (Alpha)");
  });

  it("can recover the old dev directory as a last resort", () => {
    const existingPaths = new Set(["/config/T3 Code (Dev)"]);

    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "cut3",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "CUT3" }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/T3 Code (Dev)");
  });
});

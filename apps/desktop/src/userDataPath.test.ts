import { describe, expect, it } from "vitest";

import { getLegacyUserDataDirNames, resolveDesktopUserDataPath } from "./userDataPath";

describe("getLegacyUserDataDirNames", () => {
  it("keeps the unified Rowl profile compatible with legacy directories", () => {
    expect(getLegacyUserDataDirNames({ appDisplayName: "Rowl" })).toEqual([
      "Rowl",
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
        userDataDirName: "rowl",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "Rowl" }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/CUT3");
  });

  it("falls back to the clean userData dir when no legacy dir exists", () => {
    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "rowl",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "Rowl" }),
        pathExists: () => false,
      }),
    ).toBe("/config/rowl");
  });

  it("can recover the old alpha directory too", () => {
    const existingPaths = new Set(["/config/T3 Code (Alpha)"]);

    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "rowl",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "Rowl" }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/T3 Code (Alpha)");
  });

  it("can recover the old dev directory as a last resort", () => {
    const existingPaths = new Set(["/config/T3 Code (Dev)"]);

    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "rowl",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "Rowl" }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/T3 Code (Dev)");
  });
});

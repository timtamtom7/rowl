import { registerCustomTheme } from "@pierre/diffs";

import { AMOLED_GITHUB_THEME, AMOLED_GITHUB_THEME_NAME } from "./amoledGithubTheme";
import { LILAC_THEME, LILAC_THEME_NAME } from "./lilacTheme";

let sharedHighlighterThemesRegistered = false;

export function ensureSharedHighlighterThemesRegistered(): void {
  if (sharedHighlighterThemesRegistered) {
    return;
  }

  registerCustomTheme(AMOLED_GITHUB_THEME_NAME, () => Promise.resolve(AMOLED_GITHUB_THEME));
  registerCustomTheme(LILAC_THEME_NAME, () => Promise.resolve(LILAC_THEME));
  sharedHighlighterThemesRegistered = true;
}

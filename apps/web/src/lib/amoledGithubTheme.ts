import { type ThemeRegistrationResolved } from "@pierre/diffs";

/**
 * AMOLED GitHub Theme — a pure-black variant of GitHub Dark Default
 * designed for OLED/AMOLED displays.
 *
 * Background: #000000 (true black for pixel-off battery savings)
 * Syntax palette: GitHub Dark Default token colors
 *
 * @see https://vscodethemes.com/e/T3M1N4L.amoled-github/amoled-github-theme
 */

export const AMOLED_GITHUB_THEME_NAME = "amoled-github" as const;
export const AMOLED_GITHUB_THEME_BACKGROUND = "#000000" as const;
export const AMOLED_GITHUB_THEME_FOREGROUND = "#e6edf3" as const;

export const AMOLED_GITHUB_THEME = {
  name: AMOLED_GITHUB_THEME_NAME,
  type: "dark",
  colors: {
    foreground: "#e6edf3",
    "editor.background": AMOLED_GITHUB_THEME_BACKGROUND,
    "editor.foreground": AMOLED_GITHUB_THEME_FOREGROUND,
    "editorCursor.foreground": "#e6edf3",
    "editor.lineHighlightBackground": "#0d1117",
    "editor.selectionBackground": "#1f6feb44",
    "editorWhitespace.foreground": "#21262d",
    "editorLineNumber.foreground": "#7d8590",
    "editorIndentGuide.background": "#21262d",
    "sideBar.background": "#010409",
    "sideBar.foreground": "#e6edf3",
    "activityBar.background": "#000000",
    "activityBar.foreground": "#e6edf3",
    "tab.activeBackground": "#000000",
    "tab.inactiveBackground": "#010409",
    "tab.inactiveForeground": "#7d8590",
    "titleBar.activeBackground": "#000000",
    "panel.background": "#010409",
    "panel.border": "#21262d",
    "input.background": "#0d1117",
    "input.foreground": "#e6edf3",
    "input.border": "#21262d",
    "input.placeholderForeground": "#484f58",
    focusBorder: "#1f6feb",
    "button.background": "#238636",
    "button.foreground": "#ffffff",
    "badge.background": "#1f6feb",
    "badge.foreground": "#ffffff",
    "statusBar.background": "#000000",
    "statusBar.foreground": "#7d8590",
    "editorWidget.background": "#0d1117",
    "editorWidget.border": "#30363d",
    "editorBracketMatch.background": "#1f6feb33",
    "editorBracketMatch.border": "#1f6feb",
    "editorGutter.background": "#000000",
    "editorGutter.modifiedBackground": "#d29922",
    "editorGutter.addedBackground": "#238636",
    "editorGutter.deletedBackground": "#da3633",
    "gitDecoration.modifiedResourceForeground": "#d29922",
    "gitDecoration.deletedResourceForeground": "#f85149",
    "gitDecoration.untrackedResourceForeground": "#3fb950",
    "gitDecoration.ignoredResourceForeground": "#484f58",
    "scrollbarSlider.background": "#7d859033",
    "scrollbarSlider.hoverBackground": "#7d859055",
    "scrollbarSlider.activeBackground": "#7d8590aa",
    "terminal.background": "#000000",
    "terminal.foreground": "#e6edf3",
    "terminal.ansiBlack": "#0d1117",
    "terminal.ansiRed": "#ff7b72",
    "terminal.ansiGreen": "#3fb950",
    "terminal.ansiYellow": "#d29922",
    "terminal.ansiBlue": "#58a6ff",
    "terminal.ansiMagenta": "#bc8cff",
    "terminal.ansiCyan": "#39d2c0",
    "terminal.ansiWhite": "#e6edf3",
    "terminal.ansiBrightBlack": "#484f58",
    "terminal.ansiBrightRed": "#ffa198",
    "terminal.ansiBrightGreen": "#56d364",
    "terminal.ansiBrightYellow": "#e3b341",
    "terminal.ansiBrightBlue": "#79c0ff",
    "terminal.ansiBrightMagenta": "#d2a8ff",
    "terminal.ansiBrightCyan": "#56d4dd",
    "terminal.ansiBrightWhite": "#f0f6fc",
  },
  fg: AMOLED_GITHUB_THEME_FOREGROUND,
  bg: AMOLED_GITHUB_THEME_BACKGROUND,
  settings: [
    {
      settings: {
        foreground: AMOLED_GITHUB_THEME_FOREGROUND,
        background: AMOLED_GITHUB_THEME_BACKGROUND,
      },
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: {
        foreground: "#8b949e",
        fontStyle: "italic",
      },
    },
    {
      scope: [
        "keyword",
        "storage",
        "keyword.control",
        "keyword.operator.word",
        "keyword.operator.new",
        "keyword.operator.expression",
        "keyword.control.directive",
        "keyword.other.directive",
        "meta.preprocessor",
        "punctuation.definition.directive",
      ],
      settings: {
        foreground: "#ff7b72",
      },
    },
    {
      scope: [
        "storage.type",
        "support.type",
        "support.type.primitive",
        "entity.name.type",
        "entity.name.class",
        "entity.name.struct",
        "entity.name.enum",
        "entity.name.namespace",
        "entity.name.type.class",
      ],
      settings: {
        foreground: "#ffa657",
      },
    },
    {
      scope: [
        "string",
        "string.quoted",
        "string.template",
        "string.quoted.other.lt-gt.include",
        "entity.name.filename",
      ],
      settings: {
        foreground: "#a5d6ff",
      },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: {
        foreground: "#d2a8ff",
      },
    },
    {
      scope: [
        "variable",
        "variable.language",
        "variable.other.readwrite",
        "variable.other.object",
        "variable.function",
        "support.variable",
      ],
      settings: {
        foreground: "#ffa657",
      },
    },
    {
      scope: ["variable.parameter"],
      settings: {
        foreground: "#e6edf3",
      },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language",
        "constant.character.escape",
        "constant.other",
        "support.constant",
      ],
      settings: {
        foreground: "#79c0ff",
      },
    },
    {
      scope: ["keyword.operator", "punctuation", "meta.brace", "meta.delimiter", "meta.separator"],
      settings: {
        foreground: "#c9d1d9",
      },
    },
    {
      scope: ["entity.name.tag", "support.class.component"],
      settings: {
        foreground: "#7ee787",
      },
    },
    {
      scope: ["entity.other.attribute-name"],
      settings: {
        foreground: "#79c0ff",
      },
    },
    {
      scope: ["meta.property-value", "support.constant.property-value", "constant.other.color"],
      settings: {
        foreground: "#a5d6ff",
      },
    },
    {
      scope: ["markup.deleted", "meta.diff.header.from-file", "punctuation.definition.deleted"],
      settings: {
        foreground: "#ffa198",
      },
    },
    {
      scope: ["markup.inserted", "meta.diff.header.to-file", "punctuation.definition.inserted"],
      settings: {
        foreground: "#56d364",
      },
    },
    {
      scope: ["markup.changed"],
      settings: {
        foreground: "#e3b341",
      },
    },
    {
      scope: ["meta.diff", "meta.diff.header"],
      settings: {
        foreground: "#8b949e",
      },
    },
    {
      scope: ["entity.name.section.markdown", "markup.heading"],
      settings: {
        foreground: "#79c0ff",
        fontStyle: "bold",
      },
    },
    {
      scope: ["punctuation.definition.heading.markdown"],
      settings: {
        foreground: "#79c0ff",
      },
    },
    {
      scope: ["markup.raw.inline.markdown"],
      settings: {
        foreground: "#a5d6ff",
      },
    },
    {
      scope: ["markup.underline.link.markdown", "markup.underline.link.image.markdown"],
      settings: {
        foreground: "#58a6ff",
      },
    },
    {
      scope: ["markup.bold.markdown"],
      settings: {
        foreground: "#e6edf3",
        fontStyle: "bold",
      },
    },
    {
      scope: ["markup.italic.markdown"],
      settings: {
        foreground: "#e6edf3",
        fontStyle: "italic",
      },
    },
    {
      scope: ["meta.structure.dictionary.json string.quoted.double.json"],
      settings: {
        foreground: "#7ee787",
      },
    },
    {
      scope: ["meta.structure.dictionary.value.json string.quoted.double.json"],
      settings: {
        foreground: "#a5d6ff",
      },
    },
    {
      scope: ["string.regexp"],
      settings: {
        foreground: "#7ee787",
      },
    },
  ],
} as const satisfies ThemeRegistrationResolved;

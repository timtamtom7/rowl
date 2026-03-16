import "../../index.css";

import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Sidebar, SidebarProvider, SidebarTrigger, useSidebar } from "./sidebar";

type SidebarStateValue = "expanded" | "collapsed";

function SidebarStateProbe() {
  const { state } = useSidebar();

  return <output data-testid="sidebar-state">{state}</output>;
}

function SidebarHarness({ keyboardShortcut = false }: { keyboardShortcut?: boolean }) {
  return (
    <div className="fixed inset-0 overflow-hidden">
      <SidebarProvider {...(keyboardShortcut ? { keyboardShortcut: "b" } : {})} defaultOpen>
        <Sidebar
          side="left"
          collapsible="offcanvas"
          className="border-r border-border bg-card text-foreground"
        >
          <div className="p-4 text-sm font-medium text-foreground">Threads</div>
        </Sidebar>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4">
          <SidebarTrigger />
          <SidebarStateProbe />
        </main>
      </SidebarProvider>
    </div>
  );
}

async function mountSidebar(options: { keyboardShortcut: boolean } = { keyboardShortcut: false }) {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.width = "100vw";
  host.style.height = "100vh";
  host.style.overflow = "hidden";
  document.body.append(host);

  const screen = await render(<SidebarHarness keyboardShortcut={options.keyboardShortcut} />, {
    container: host,
  });

  return {
    cleanup: async () => {
      await screen.unmount();
      host.remove();
    },
  };
}

async function waitForSidebarTrigger(): Promise<HTMLButtonElement> {
  await vi.waitFor(
    () => {
      expect(document.querySelector("[data-slot='sidebar-trigger']")).not.toBeNull();
    },
    { timeout: 4_000, interval: 16 },
  );

  return document.querySelector("[data-slot='sidebar-trigger']") as HTMLButtonElement;
}

async function waitForSidebarState(state: SidebarStateValue): Promise<void> {
  await vi.waitFor(
    () => {
      expect(document.querySelector("[data-testid='sidebar-state']")?.textContent).toBe(state);
    },
    { timeout: 4_000, interval: 16 },
  );
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 50);
  });
}

function parseCssColor(value: string): [number, number, number] {
  const match = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);
  if (!match) {
    throw new Error(`Unsupported color format: ${value}`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const linear = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = linear;
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(parseCssColor(foreground));
  const bg = relativeLuminance(parseCssColor(background));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function SidebarThemeContrastHarness() {
  return (
    <div data-testid="sidebar-surface" className="bg-sidebar text-sidebar-foreground p-4">
      <button
        type="button"
        data-testid="sidebar-add-project-button"
        className="inline-flex size-5 items-center justify-center rounded-md text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      />
      <button
        type="button"
        data-testid="sidebar-settings-button"
        className="gap-2 px-2 py-1.5 text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        Settings
      </button>
    </div>
  );
}

describe("SidebarTrigger", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
    document.body.innerHTML = "";
    vi.stubGlobal("cookieStore", {
      set: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    delete document.documentElement.dataset.theme;
  });

  it("toggles the desktop sidebar from the header trigger", async () => {
    const mounted = await mountSidebar();

    try {
      const trigger = await waitForSidebarTrigger();
      await waitForSidebarState("expanded");
      expect(trigger.title).toBe("Toggle sidebar");
      expect(trigger.getAttribute("aria-label")).toBe("Collapse sidebar");

      trigger.click();
      await waitForSidebarState("collapsed");
      expect(trigger.getAttribute("aria-label")).toBe("Expand sidebar");

      trigger.click();
      await waitForSidebarState("expanded");
      expect(trigger.getAttribute("aria-label")).toBe("Collapse sidebar");
    } finally {
      await mounted.cleanup();
    }
  });

  it("supports the configured Ctrl+B sidebar shortcut on desktop", async () => {
    const mounted = await mountSidebar({ keyboardShortcut: true });

    try {
      const trigger = await waitForSidebarTrigger();
      await waitForSidebarState("expanded");
      expect(trigger.title).toContain("Ctrl+B");

      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          bubbles: true,
          cancelable: true,
        }),
      );
      await settle();
      expect(document.querySelector("[data-testid='sidebar-state']")?.textContent).toBe("expanded");

      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await waitForSidebarState("collapsed");

      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await waitForSidebarState("expanded");
    } finally {
      await mounted.cleanup();
    }
  });

  it("keeps sidebar action controls readable under custom themes", async () => {
    document.documentElement.dataset.theme = "nord";

    const host = document.createElement("div");
    document.body.append(host);
    const screen = await render(<SidebarThemeContrastHarness />, { container: host });

    try {
      const surface = document.querySelector<HTMLElement>("[data-testid='sidebar-surface']");
      const addProjectButton = document.querySelector<HTMLElement>(
        "[data-testid='sidebar-add-project-button']",
      );
      const settingsButton = document.querySelector<HTMLElement>(
        "[data-testid='sidebar-settings-button']",
      );

      expect(surface).not.toBeNull();
      expect(addProjectButton).not.toBeNull();
      expect(settingsButton).not.toBeNull();

      const surfaceBackground = window.getComputedStyle(surface!).backgroundColor;
      const addProjectColor = window.getComputedStyle(addProjectButton!).color;
      const settingsColor = window.getComputedStyle(settingsButton!).color;

      expect(contrastRatio(addProjectColor, surfaceBackground)).toBeGreaterThan(4.5);
      expect(contrastRatio(settingsColor, surfaceBackground)).toBeGreaterThan(4.5);
    } finally {
      await screen.unmount();
      host.remove();
    }
  });
});

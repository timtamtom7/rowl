import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { RightSidebarTab } from "./RightSidebar";

// ── Focus target for cross-tab navigation ──────────────────────
export interface SidebarFocusTarget {
  type: "thread" | "feature" | "goal" | "memory" | "file";
  id: string;
}

// ── Persisted tab state ────────────────────────────────────────
const PERSISTED_TAB_KEY = "rowl:sidebar:activeTab";

function readPersistedTab(): RightSidebarTab {
  try {
    const stored = localStorage.getItem(PERSISTED_TAB_KEY);
    if (
      stored === "pm-chat" ||
      stored === "threads" ||
      stored === "features" ||
      stored === "goals" ||
      stored === "context" ||
      stored === "memory" ||
      stored === "map"
    ) {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "pm-chat";
}

function persistTab(tab: RightSidebarTab): void {
  try {
    localStorage.setItem(PERSISTED_TAB_KEY, tab);
  } catch {
    // Ignore
  }
}

// ── Context ────────────────────────────────────────────────────

interface RightSidebarContextValue {
  rightSidebarExpanded: boolean;
  setRightSidebarExpanded: (expanded: boolean) => void;
  toggleRightSidebar: () => void;

  activeTab: RightSidebarTab;
  setActiveTab: (tab: RightSidebarTab) => void;

  /** Navigate to a specific tab, optionally focusing on an item */
  navigateToTab: (tab: RightSidebarTab, focus?: SidebarFocusTarget) => void;

  /** The current focus target (set by navigateToTab, cleared after consumption) */
  focusTarget: SidebarFocusTarget | null;
  clearFocusTarget: () => void;
}

const RightSidebarContext = createContext<RightSidebarContextValue | null>(null);

interface RightSidebarProviderProps {
  children: ReactNode;
}

export function RightSidebarProvider({ children }: RightSidebarProviderProps) {
  const [rightSidebarExpanded, setRightSidebarExpanded] = useState(false);
  const [activeTab, setActiveTabState] = useState<RightSidebarTab>(readPersistedTab);
  const [focusTarget, setFocusTarget] = useState<SidebarFocusTarget | null>(null);

  const toggleRightSidebar = useCallback(() => {
    setRightSidebarExpanded((prev) => !prev);
  }, []);

  const setActiveTab = useCallback((tab: RightSidebarTab) => {
    setActiveTabState(tab);
    persistTab(tab);
  }, []);

  const navigateToTab = useCallback(
    (tab: RightSidebarTab, focus?: SidebarFocusTarget) => {
      setActiveTab(tab);
      setRightSidebarExpanded(true);
      if (focus) {
        setFocusTarget(focus);
      }
    },
    [setActiveTab],
  );

  const clearFocusTarget = useCallback(() => {
    setFocusTarget(null);
  }, []);

  const value = useMemo(
    () => ({
      rightSidebarExpanded,
      setRightSidebarExpanded,
      toggleRightSidebar,
      activeTab,
      setActiveTab,
      navigateToTab,
      focusTarget,
      clearFocusTarget,
    }),
    [
      rightSidebarExpanded,
      toggleRightSidebar,
      activeTab,
      setActiveTab,
      navigateToTab,
      focusTarget,
      clearFocusTarget,
    ],
  );

  return <RightSidebarContext.Provider value={value}>{children}</RightSidebarContext.Provider>;
}

export function useRightSidebar(): RightSidebarContextValue {
  const context = useContext(RightSidebarContext);
  if (!context) {
    throw new Error("useRightSidebar must be used within a RightSidebarProvider");
  }
  return context;
}

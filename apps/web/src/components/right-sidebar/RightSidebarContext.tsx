import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

interface RightSidebarContextValue {
  rightSidebarExpanded: boolean;
  setRightSidebarExpanded: (expanded: boolean) => void;
  toggleRightSidebar: () => void;
}

const RightSidebarContext = createContext<RightSidebarContextValue | null>(null);

interface RightSidebarProviderProps {
  children: ReactNode;
}

export function RightSidebarProvider({ children }: RightSidebarProviderProps) {
  const [rightSidebarExpanded, setRightSidebarExpanded] = useState(false);

  const toggleRightSidebar = useCallback(() => {
    setRightSidebarExpanded((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({ rightSidebarExpanded, setRightSidebarExpanded, toggleRightSidebar }),
    [rightSidebarExpanded, toggleRightSidebar],
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

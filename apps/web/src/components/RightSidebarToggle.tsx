import { useMemo } from "react";

import { useAppSettings } from "../appSettings";
import { PanelRightIcon, PanelRightCloseIcon } from "lucide-react";
import { Button } from "./ui/button";
import { useRightSidebar } from "./right-sidebar/RightSidebarContext";

export default function RightSidebarToggle({ className }: { className?: string }) {
  const { rightSidebarExpanded, toggleRightSidebar } = useRightSidebar();
  const {
    settings: { language },
  } = useAppSettings();
  const toggleLabel = useMemo(() => {
    if (language === "fa") {
      return "تغییر نوار کناری راست";
    }
    return rightSidebarExpanded ? "Close right sidebar" : "Open right sidebar";
  }, [language, rightSidebarExpanded]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={toggleRightSidebar}
      title={toggleLabel}
    >
      {rightSidebarExpanded ? (
        <PanelRightCloseIcon className="size-4" />
      ) : (
        <PanelRightIcon className="size-4" />
      )}
    </Button>
  );
}

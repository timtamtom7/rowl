import { memo, useState, useCallback, useEffect } from "react";
import {
  PanelRightCloseIcon,
  SparklesIcon,
  ListIcon,
  LayoutGridIcon,
  TargetIcon,
  DatabaseIcon,
  FolderIcon,
  GitBranchIcon,
  NetworkIcon,
  BrainIcon,
} from "lucide-react";
import type { GoalId, ProjectId } from "@t3tools/contracts";
import { cn } from "~/lib/utils";
import { useStore } from "~/store";
import { useRightSidebar } from "./RightSidebarContext";
import { resolveServerHttpUrl } from "~/lib/serverUrl";
import { ThreadsTabContent } from "./ThreadsTabContent";
import { FeaturesTabContent } from "./FeaturesTabContent";
import { ContextTabContent } from "./ContextTabContent";
import { PMChatTabContent } from "./PMChatTabContent";
import { ProjectBrief } from "./ProjectBrief";
import { SkillsSection } from "./SkillsSection";
import { MemoryTabContent } from "./MemoryTabContent";
import { LiveMapTabContent } from "./LiveMapTabContent";
import { ProjectPromptsSection } from "./ProjectPromptsSection";
import { AgentPanel } from "~/core-agent/AgentPanel";
import { ApprovalPanel } from "~/organizing/ApprovalPanel";
import { DocumentPanel } from "~/organizing/DocumentPanel";
import { GoalsPanel } from "~/organizing/GoalsPanel";
import { WorktreePanel } from "~/git/WorktreePanel";

export { RightSidebarProvider } from "./RightSidebarContext";

export type RightSidebarTab =
  | "pm-chat"
  | "threads"
  | "features"
  | "goals"
  | "worktrees"
  | "context"
  | "memory"
  | "map";

interface TabConfig {
  id: RightSidebarTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { id: "pm-chat", label: "PM", icon: <SparklesIcon className="size-4" /> },
  { id: "threads", label: "Threads", icon: <ListIcon className="size-4" /> },
  { id: "features", label: "Features", icon: <LayoutGridIcon className="size-4" /> },
  { id: "goals", label: "Goals", icon: <TargetIcon className="size-4" /> },
  { id: "worktrees", label: "Worktrees", icon: <GitBranchIcon className="size-4" /> },
  { id: "context", label: "Context", icon: <DatabaseIcon className="size-4" /> },
  { id: "memory", label: "Memory", icon: <BrainIcon className="size-4" /> },
  { id: "map", label: "Map", icon: <NetworkIcon className="size-4" /> },
];

// Above this width, expanded sidebar is inline (pushes content)
// Below this width, expanded sidebar is an overlay (floats on top)
const INLINE_EXPANDED_WIDTH = 1280;

function renderTabContent(
  activeTab: RightSidebarTab,
  projectId?: ProjectId | undefined,
  projectCwd?: string | undefined,
) {
  if (activeTab === "pm-chat" && projectId) {
    return <PMChatTabContent projectId={projectId} projectCwd={projectCwd} />;
  }
  if (activeTab === "threads" && projectId) {
    return <ThreadsTabContent projectId={projectId} />;
  }
  if (activeTab === "features" && projectId) {
    return <FeaturesTabContent projectId={projectId} />;
  }
  if (activeTab === "goals" && projectId) {
    return <OrganizingTabContent projectId={projectId} projectCwd={projectCwd} />;
  }
  if (activeTab === "worktrees" && projectId) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <WorktreePanel cwd={projectCwd} />
      </div>
    );
  }
  if (activeTab === "context" && projectId) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <AgentPanel projectRoot={projectCwd} />
        <ContextTabContent projectId={projectId} />
        <MemoryTabContent projectId={projectId} />
        {projectCwd && <SkillsSection projectId={projectId} projectCwd={projectCwd} />}
      </div>
    );
  }
  if (activeTab === "memory" && projectId) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <AgentPanel projectRoot={projectCwd} defaultTab="memory" />
      </div>
    );
  }
  if (activeTab === "map" && projectId) {
    return <LiveMapTabContent projectId={projectId} projectCwd={projectCwd} />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
      <p className="text-sm text-muted-foreground">Select a project to get started.</p>
      <p className="text-xs text-muted-foreground/50 mt-1">
        Add a project folder from the sidebar to access PM, features, goals, and more.
      </p>
    </div>
  );
}

function OrganizingTabContent({
  projectId,
  projectCwd,
}: {
  readonly projectId: ProjectId;
  readonly projectCwd?: string | undefined;
}) {
  const [selectedGoalId, setSelectedGoalId] = useState<GoalId | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {projectCwd && <ProjectBrief projectCwd={projectCwd} />}
      <GoalsPanel
        projectId={projectId}
        selectedGoalId={selectedGoalId}
        onSelectedGoalIdChange={(goalId) => setSelectedGoalId(goalId)}
      />
      <DocumentPanel goalId={selectedGoalId} />
      <ApprovalPanel goalId={selectedGoalId} />
      <ProjectPromptsSection projectId={projectId} />
    </div>
  );
}

function ProjectIcon({
  cwd,
  className,
}: {
  cwd?: string | undefined;
  className?: string | undefined;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  if (!cwd || status === "error") {
    return <FolderIcon className={cn("shrink-0 text-muted-foreground/70", className)} />;
  }

  const src = resolveServerHttpUrl(`/api/project-favicon?cwd=${encodeURIComponent(cwd)}`);

  return (
    <img
      src={src}
      alt=""
      className={cn(
        "shrink-0 rounded-sm object-contain",
        status === "loading" ? "hidden" : "",
        className,
      )}
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("error")}
    />
  );
}

interface RightSidebarProps {
  className?: string | undefined;
  projectCwd?: string | undefined;
  projectId?: ProjectId | undefined;
}

function ExpandedSidebarContent({
  activeTab,
  setActiveTab,
  closeSidebar,
  projectCwd,
  projectId,
}: {
  activeTab: RightSidebarTab;
  setActiveTab: (tab: RightSidebarTab) => void;
  closeSidebar: () => void;
  projectCwd?: string | undefined;
  projectId?: ProjectId | undefined;
}) {
  const threads = useStore((store) => store.threads);
  const runningCount = projectId
    ? threads.filter((t) => t.projectId === projectId && t.session?.status === "running").length
    : 0;

  return (
    <>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/55 bg-card/25 px-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <ProjectIcon cwd={projectCwd} className="size-4" />
          {TABS.map(
            (tab) =>
              activeTab === tab.id && (
                <span key={tab.id} className="flex items-center gap-1.5 text-sm font-medium">
                  {tab.icon}
                  {tab.label}
                </span>
              ),
          )}
          {runningCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium animate-pulse">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {runningCount} active
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={closeSidebar}
          aria-label="Collapse right sidebar"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-accent/55 hover:text-foreground/78"
        >
          <PanelRightCloseIcon className="size-4" />
        </button>
      </div>

      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border/45 bg-card/18 px-2 backdrop-blur-xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            className={cn(
              "app-interactive-motion flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-[background-color,color,box-shadow,transform]",
              activeTab === tab.id
                ? "bg-accent/90 text-accent-foreground shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)]"
                : "text-muted-foreground/60 hover:bg-accent/50 hover:text-foreground/80 motion-safe:hover:-translate-y-px",
            )}
          >
            {tab.icon}
            <span className="hidden">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div key={activeTab} className="app-right-sidebar-tab-motion h-full min-h-0">
          {renderTabContent(activeTab, projectId, projectCwd)}
        </div>
      </div>
    </>
  );
}

const RightSidebar = memo(function RightSidebar({
  className,
  projectCwd,
  projectId,
}: RightSidebarProps) {
  const { rightSidebarExpanded, setRightSidebarExpanded, activeTab, setActiveTab } =
    useRightSidebar();
  const [isOverlayMode, setIsOverlayMode] = useState(
    () => typeof window !== "undefined" && window.innerWidth < INLINE_EXPANDED_WIDTH,
  );

  const closeSidebar = useCallback(() => {
    setRightSidebarExpanded(false);
  }, [setRightSidebarExpanded]);

  // Track whether we're in overlay mode (narrow) or inline mode (wide)
  useEffect(() => {
    const handleResize = () => {
      setIsOverlayMode(window.innerWidth < INLINE_EXPANDED_WIDTH);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Collapsed state — hidden below 1024px
  if (!rightSidebarExpanded) {
    return (
      <div
        className={cn(
          "app-sidebar-motion relative hidden h-full w-12 shrink-0 flex-col items-center gap-1 border-l border-border/55 bg-card/38 py-2 shadow-[inset_1px_0_0_color-mix(in_oklab,var(--foreground)_3%,transparent)] backdrop-blur-xl min-[1024px]:flex",
          className,
        )}
        data-state="collapsed"
      >
        <div className="flex items-center justify-center py-2">
          <ProjectIcon cwd={projectCwd} className="size-5" />
        </div>

        <div className="flex flex-col items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setRightSidebarExpanded(true);
              }}
              aria-label={tab.label}
              aria-selected={activeTab === tab.id}
              className={cn(
                "flex size-8 items-center justify-center rounded-md transition-[background-color,color,box-shadow]",
                activeTab === tab.id
                  ? "bg-accent/90 text-accent-foreground shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)]"
                  : "text-muted-foreground/50 hover:bg-accent/50 hover:text-foreground/70",
              )}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Expanded — overlay mode (narrow window): fixed overlay with backdrop
  if (isOverlayMode) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/12 backdrop-blur-[3px]"
          onClick={closeSidebar}
          aria-hidden="true"
        />
        <div
          className="rowl-glass-panel fixed top-0 right-0 z-50 flex h-svh w-[300px] flex-col border-l"
          data-state="expanded-overlay"
        >
          <ExpandedSidebarContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            closeSidebar={closeSidebar}
            projectCwd={projectCwd}
            projectId={projectId}
          />
        </div>
      </>
    );
  }

  // Expanded — inline mode (wide window): part of flex layout
  return (
    <div
      className={cn(
        "app-sidebar-motion relative flex h-full w-[300px] shrink-0 flex-col border-l border-border/55 bg-card/38 shadow-[inset_1px_0_0_color-mix(in_oklab,var(--foreground)_3%,transparent)] backdrop-blur-xl",
        className,
      )}
      data-state="expanded"
    >
      <ExpandedSidebarContent
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        closeSidebar={closeSidebar}
        projectCwd={projectCwd}
        projectId={projectId}
      />
    </div>
  );
});

export default RightSidebar;

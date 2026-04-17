import { createFileRoute } from "@tanstack/react-router";

import { isElectron } from "../env";
import ThreadNewButton from "../components/ThreadNewButton";
import ThreadSidebarToggle from "../components/ThreadSidebarToggle";
import { EmptyChatOnboarding } from "../components/chat/EmptyChatOnboarding";
import { ProjectDashboard } from "../components/dashboard/ProjectDashboard";
import { useStore } from "../store";

function ChatIndexRouteView() {
  const projects = useStore((store) => store.projects);
  const hasProjects = projects.length > 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-muted-foreground/40">
      {!isElectron && (
        <header className="border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <ThreadSidebarToggle />
            <ThreadNewButton />
            <span className="text-sm font-medium text-foreground">
              {hasProjects ? "Dashboard" : "Threads"}
            </span>
          </div>
        </header>
      )}

      {isElectron && (
        <div className="drag-region flex h-[52px] shrink-0 items-center gap-2 border-b border-border px-5">
          <ThreadSidebarToggle />
          <ThreadNewButton />
          <span className="text-xs text-muted-foreground/50">
            {hasProjects ? "Dashboard" : "No active thread"}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {hasProjects ? (
          <ProjectDashboard />
        ) : (
          <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 min-h-full">
            <EmptyChatOnboarding />
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});

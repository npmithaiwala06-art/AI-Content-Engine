import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { FirstRunOnboarding } from "./FirstRunOnboarding";
import { AppUpdater } from "./AppUpdater";
import { PageErrorBoundary } from "./PageErrorBoundary";

const pageMeta: Record<string, { title: string; description: string }> = {
  "/": { title: "Good afternoon, Neev", description: "Here’s what’s happening across your social operations." },
  "/clients": { title: "Clients", description: "Manage client brands, memory, assets and social presence." },
  "/ai-workspace": { title: "AI Workspace", description: "Generate structured social content from local Brand Memory." },
  "/ai-workspace/import": { title: "Import ChatGPT Result", description: "Validate, review and save structured content as local drafts." },
  "/chatgpt": { title: "ChatGPT", description: "Connect your subscription through the official Codex client." },
  "/create": { title: "Create Content", description: "Turn one idea into native content for every platform." },
  "/campaigns": { title: "Campaigns", description: "Connect goals, content, media, calendars and results." },
  "/plans": { title: "Content Plans", description: "Organise one-off posts, campaigns and monthly plans." },
  "/calendar": { title: "Content Calendar", description: "Review and reschedule every client’s publishing plan." },
  "/approvals": { title: "Approvals", description: "Human review is the required checkpoint before scheduling." },
  "/scheduled": { title: "Scheduled", description: "Monitor the local publishing queue on this Mac." },
  "/publishing-queue": { title: "Publishing Queue", description: "Track queued, publishing, retrying and completed jobs." },
  "/published": { title: "Published", description: "View published content and platform results." },
  "/media": { title: "Media Library", description: "Manage local images, video, logos and brand assets." },
  "/accounts": { title: "Social Accounts", description: "Manage secure platform connections and mock mode." },
  "/analytics": { title: "Analytics", description: "Compare client and platform performance stored locally." },
  "/reports": { title: "Reports", description: "Build weekly, monthly, campaign and client reports." },
  "/activity": { title: "Activity", description: "Review the local audit trail across all client operations." },
  "/settings": { title: "Settings", description: "Configure local storage, scheduling and application preferences." },
  "/readiness": { title: "Release Readiness", description: "Verify the four remaining external and production phases." },
};

export function AppLayout() {
  const { pathname } = useLocation();
  const meta = pathname.startsWith("/clients/") ? { title: "Client Workspace", description: "Brand memory, content operations and performance in one local view." } : pageMeta[pathname] ?? pageMeta["/"];
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("ui.sidebarCollapsed") === "true");

  useEffect(() => {
    localStorage.setItem("ui.sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((current) => !current)} />
      <div className="app-main">
        <Header {...meta} />
        <main className="page-content"><PageErrorBoundary resetKey={pathname}><Outlet /></PageErrorBoundary></main>
      </div>
      <FirstRunOnboarding />
      <AppUpdater />
    </div>
  );
}

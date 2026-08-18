import {
  BarChart3,
  CalendarDays,
  CheckSquare2,
  ChevronLeft,
  Clock3,
  FileBarChart,
  FileStack,
  Image,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Plus,
  Send,
  Settings,
  Sparkles,
  History,
  Users,
  Wifi,
  ClipboardCheck,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Logo } from "./Logo";
import { isDesktopRuntime } from "../services/desktop";

const primaryNavigation = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Clients", to: "/clients", icon: Users },
  { label: "AI Workspace", to: "/ai-workspace", icon: Sparkles, accent: true },
  { label: "Create Content", to: "/create", icon: Plus },
  { label: "Campaigns", to: "/campaigns", icon: Megaphone },
  { label: "Content Plans", to: "/plans", icon: FileStack },
  { label: "Calendar", to: "/calendar", icon: CalendarDays },
];

const operationsNavigation = [
  { label: "Approvals", to: "/approvals", icon: CheckSquare2, count: 7 },
  { label: "Scheduled", to: "/scheduled", icon: Clock3 },
  { label: "Publishing Queue", to: "/publishing-queue", icon: ListChecks },
  { label: "Published", to: "/published", icon: Send },
  { label: "Media Library", to: "/media", icon: Image },
];

const insightsNavigation = [
  { label: "Social Accounts", to: "/accounts", icon: Wifi },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Reports", to: "/reports", icon: FileBarChart },
  { label: "Activity", to: "/activity", icon: History },
  { label: "Release Readiness", to: "/readiness", icon: ClipboardCheck },
];

type NavItem = (typeof primaryNavigation)[number] & { count?: number };

function NavigationSection({ title, items, collapsed }: { title?: string; items: NavItem[]; collapsed: boolean }) {
  const previewMode = !isDesktopRuntime();
  return (
    <div className="nav-section">
      {title && !collapsed && <p className="nav-section-label">{title}</p>}
      <nav>
        {items.map(({ label, to, icon: Icon, count, accent }) => (
          <NavLink key={to} to={to} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <Icon size={18} strokeWidth={1.9} className={accent ? "ai-icon" : ""} />
            <span>{label}</span>
            {count && previewMode ? <b>{count}</b> : null}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const previewMode = !isDesktopRuntime();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo-row">
        <Logo compact={collapsed} />
        <button type="button" className="icon-button subtle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onToggle}><ChevronLeft size={17} /></button>
      </div>
      <div className="workspace-switcher">
        <div className="workspace-avatar"><Megaphone size={16} /></div>
        {!collapsed && <div><strong>My Agency</strong><small>{previewMode ? "8 sample clients" : "Local workspace"}</small></div>}
      </div>
      <div className="sidebar-scroll">
        <NavigationSection items={primaryNavigation} collapsed={collapsed} />
        <NavigationSection title="OPERATIONS" items={operationsNavigation} collapsed={collapsed} />
        <NavigationSection title="INSIGHTS" items={insightsNavigation} collapsed={collapsed} />
      </div>
      <div className="sidebar-footer">
        <NavLink to="/settings" title={collapsed ? "Settings" : undefined} aria-label={collapsed ? "Settings" : undefined} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
          <Settings size={18} /><span>Settings</span>
        </NavLink>
        <div className="local-status" title="Local system online — all data stays on this Mac"><span />{!collapsed && <div><strong>Local system online</strong><small>All data stays on this Mac</small></div>}</div>
      </div>
    </aside>
  );
}

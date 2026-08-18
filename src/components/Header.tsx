import { Bell, CheckCircle2, ChevronDown, Command, Search, Settings, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listNotifications, markNotificationRead } from "../services/automation";
import type { NotificationRecord } from "../types/automation";
import { universalSearch } from "../services/workspace";
import type { SearchResult } from "../types/workspace";

const commands = [
  { label: "Dashboard", description: "Social operations overview", to: "/" },
  { label: "Clients", description: "Client profiles and brand memory", to: "/clients" },
  { label: "AI Workspace", description: "ChatGPT prompt and import workflow", to: "/ai-workspace" },
  { label: "Import ChatGPT Result", description: "Parse structured content into local drafts", to: "/ai-workspace/import" },
  { label: "Create Content", description: "Create platform-specific content", to: "/create" },
  { label: "Campaigns", description: "Campaign goals, content and performance", to: "/campaigns" },
  { label: "Content Plans", description: "Campaign and content planning", to: "/plans" },
  { label: "Calendar", description: "Publishing calendar", to: "/calendar" },
  { label: "Approvals", description: "Human review queue", to: "/approvals" },
  { label: "Scheduled", description: "Local publishing queue", to: "/scheduled" },
  { label: "Publishing Queue", description: "Publishing jobs, retries and failures", to: "/publishing-queue" },
  { label: "Published", description: "Published content history", to: "/published" },
  { label: "Media Library", description: "Local media and brand assets", to: "/media" },
  { label: "Social Accounts", description: "Platform connections", to: "/accounts" },
  { label: "Analytics", description: "Platform performance", to: "/analytics" },
  { label: "Reports", description: "Client and campaign reports", to: "/reports" },
  { label: "Activity", description: "Local system audit trail", to: "/activity" },
  { label: "Settings", description: "Local application preferences", to: "/settings" },
  { label: "Release Readiness", description: "Verify phases 12, 35, 37 and 40", to: "/readiness" },
];

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [dataResults, setDataResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { if (query.trim().length >= 2) universalSearch(query).then(setDataResults).catch(() => setDataResults([])); else setDataResults([]); }, 180); return () => window.clearTimeout(timer); }, [query]);

  const filteredCommands = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) => `${command.label} ${command.description}`.toLowerCase().includes(needle));
  }, [query]);

  const openSearch = () => {
    setNotificationsOpen(false);
    setProfileOpen(false);
    setSearchOpen(true);
  };
  const toggleNotifications = async () => {
    const opening = !notificationsOpen;
    setNotificationsOpen(opening); setProfileOpen(false);
    if (opening) { try { setNotifications(await listNotifications()); } catch { setNotifications([]); } }
  };
  const readNotification = async (id: string) => { await markNotificationRead(id); setNotifications((items) => items.map((item) => item.id === id ? { ...item, isRead: true } : item)); };

  const selectCommand = (to: string) => {
    navigate(to);
    setQuery("");
    setSearchOpen(false);
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        <div className="topbar-actions">
          <button type="button" className="search-trigger" onClick={openSearch} aria-label="Search application"><Search size={16} /><span>Search anything</span><kbd><Command size={11} /> K</kbd></button>
          <div className="menu-anchor">
            <button type="button" className="icon-button notification" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => void toggleNotifications()}><Bell size={18} />{notifications.some((item) => !item.isRead) && <i />}</button>
            {notificationsOpen && (
              <div className="popover notification-popover" role="dialog" aria-label="Notifications panel">
                <div className="popover-header"><strong>Notifications</strong><span>Local only</span></div>
                {notifications.length === 0 ? <div className="notification-empty"><CheckCircle2 size={24} /><strong>You’re all caught up</strong><p>Publishing failures and successes will appear here.</p></div> : <div className="notification-list">{notifications.map((item) => <button key={item.id} className={item.isRead ? "read" : ""} onClick={() => void readNotification(item.id)}><span>{item.title}</span><p>{item.body}</p><time>{new Date(item.createdAt).toLocaleString()}</time></button>)}</div>}
              </div>
            )}
          </div>
          <div className="menu-anchor">
            <button type="button" className="profile-button" aria-label="Open profile menu" aria-expanded={profileOpen} onClick={() => { setProfileOpen((open) => !open); setNotificationsOpen(false); }}>
              <span className="profile-avatar">NM</span>
              <span className="profile-copy"><strong>Neev</strong><small>Administrator</small></span>
              <ChevronDown size={14} />
            </button>
            {profileOpen && (
              <div className="popover profile-popover" role="menu">
                <div className="profile-summary"><span className="profile-avatar">NM</span><div><strong>Neev</strong><small>Local administrator</small></div></div>
                <Link to="/settings" role="menuitem" onClick={() => setProfileOpen(false)}><Settings size={15} /> Application settings</Link>
                <div className="privacy-row"><ShieldCheck size={15} /><span><strong>Private workspace</strong><small>No AI API connected</small></span></div>
              </div>
            )}
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="command-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-label="Application search" onMouseDown={(event) => event.stopPropagation()}>
            <div className="command-input-row"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages and actions…" aria-label="Search pages and actions" /><button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={17} /></button></div>
            <div className="command-results">
              {dataResults.length > 0 && <div className="command-data-label">LOCAL DATA</div>}
              {dataResults.map((result) => <button type="button" key={`${result.kind}-${result.id}`} onClick={() => selectCommand(result.path)}><span><strong>{result.title}</strong><small>{result.kind} · {result.subtitle} · {result.status}</small></span><kbd>↵</kbd></button>)}
              <div className="command-data-label">PAGES & ACTIONS</div>
              {filteredCommands.map((command) => <button type="button" key={command.to} onClick={() => selectCommand(command.to)}><span><strong>{command.label}</strong><small>{command.description}</small></span><kbd>↵</kbd></button>)}
              {filteredCommands.length === 0 && <div className="command-empty">No matching page or action.</div>}
            </div>
            <footer><span>↑↓ Browse</span><span>Enter Open</span><span>Esc Close</span></footer>
          </section>
        </div>
      )}
    </>
  );
}

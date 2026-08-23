import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileEdit,
  FilePenLine,
  Instagram,
  Plus,
  Send,
  Sparkles,
  TriangleAlert,
  Users,
  Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { activityItems, performanceData, scheduledPosts } from "../data/demoData";
import { getDashboardSummary, initialiseApplication, isDesktopRuntime } from "../services/desktop";
import type { DashboardSummary } from "../types/dashboard";
import { MetricCard } from "../components/MetricCard";
import { PlatformBadge } from "../components/PlatformBadge";
import { StatusBadge } from "../components/StatusBadge";

const emptySummary: DashboardSummary = {
  clients: 0, connectedAccounts: 0, draftPosts: 0, waitingApproval: 0,
  approved: 0, scheduled: 0, published: 0, failed: 0,
  scheduledToday: 0, publishedToday: 0, monthlyReach: 0, monthlyEngagement: 0,
  todaySchedule: [], recentActivity: [], performance: [],
};

const activityIcon = {
  published: Send,
  approved: CheckCircle2,
  scheduled: CalendarDays,
  client: Users,
};

export function DashboardPage() {
  const [summary, setSummary] = useState(emptySummary);
  const [ready, setReady] = useState(false);
  const [openPostMenu, setOpenPostMenu] = useState<string | null>(null);
  const previewMode = !isDesktopRuntime();
  const hasClients = previewMode || summary.clients > 0;
  const hasAnalytics = previewMode || summary.performance.length > 0;

  useEffect(() => {
    async function load() {
      await initialiseApplication();
      setSummary(await getDashboardSummary());
      setReady(true);
    }
    void load();
  }, []);

  const metrics = [
    { label: "Active clients", value: summary.clients, icon: Users, tone: "tone-violet", hint: hasClients ? "Local client workspaces" : "Add your first client", trend: previewMode ? 14 : undefined },
    { label: "Connected accounts", value: summary.connectedAccounts, icon: Wifi, tone: "tone-sky", hint: hasClients ? "Official and Mock Mode" : "No accounts connected", trend: previewMode ? 6 : undefined },
    { label: "Waiting approval", value: summary.waitingApproval, icon: Clock3, tone: "tone-amber", hint: summary.waitingApproval ? "Human review required" : "Inbox is clear" },
    { label: "Scheduled today", value: summary.scheduledToday, icon: CalendarDays, tone: "tone-indigo", hint: "Local scheduler", trend: previewMode ? 12 : undefined },
    { label: "Published today", value: summary.publishedToday, icon: Send, tone: "tone-green", hint: "Platform versions", trend: previewMode ? 23 : undefined },
    { label: "Needs attention", value: summary.failed, icon: TriangleAlert, tone: "tone-red", hint: "Publishing failures" },
    { label: "Monthly reach", value: summary.monthlyReach, icon: BarChart3, tone: "tone-sky", hint: "Stored analytics" },
    { label: "Monthly engagement", value: summary.monthlyEngagement, icon: Sparkles, tone: "tone-violet", hint: "Likes, comments, shares & saves" },
  ];
  const scheduleRows = previewMode ? scheduledPosts : summary.todaySchedule.map((post) => ({ id: post.id, client: post.client, initials: post.client.slice(0, 2).toUpperCase(), platform: ({ instagram: "Instagram", facebook: "Facebook", twitter: "Twitter", youtube: "YouTube" } as const)[post.platform as "instagram" | "facebook" | "twitter" | "youtube"] ?? "Instagram", title: post.title, time: new Date(post.scheduledFor).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), status: post.status.replaceAll("_", " ").replace(/\b\w/g, (value) => value.toUpperCase()) as "Scheduled", accent: "#6d4bd2" }));
  const recentRows = previewMode ? activityItems : summary.recentActivity.map((item) => ({ id: item.id, kind: (item.action === "published" ? "published" : item.action === "approved" ? "approved" : item.action === "scheduled" ? "scheduled" : "client") as keyof typeof activityIcon, title: item.summary, detail: `${item.clientName ?? "System"} · ${item.action.replaceAll("_", " ")}`, time: new Date(item.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) }));

  return (
    <div className={`dashboard ${ready ? "is-ready" : "is-loading"}`}>
      <section className="quick-create-card">
        <div className="quick-create-icon"><Sparkles size={22} /></div>
        <div><strong>Create once. Adapt everywhere.</strong><p>Turn one campaign idea into platform-native content with ChatGPT.</p></div>
        <Link className="primary-button" to="/create" aria-label="Create new content"><Plus size={16} /> Create content</Link>
      </section>

      <section className="metrics-grid">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>

      <section className="dashboard-grid">
        <article className="panel performance-panel">
          <div className="panel-header">
            <div><h2>Platform performance</h2><p>Organic reach over the last 7 days</p></div>
            <div className="chart-legend"><span className="legend-violet">Instagram</span><span className="legend-blue">Facebook</span><span className="legend-sky">Twitter</span></div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={previewMode ? performanceData : summary.performance} margin={{ top: 10, right: 8, left: -23, bottom: 0 }}>
                <defs>
                  <linearGradient id="ig" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.22}/><stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/></linearGradient>
                  <linearGradient id="fb" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9ebf1" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#8b91a1", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8b91a1", fontSize: 11 }} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e6e8ee", boxShadow: "0 10px 30px rgba(30, 27, 75, .1)", fontSize: 12 }} />
                <Area type="monotone" dataKey="instagram" stroke="#7c3aed" strokeWidth={2.4} fill="url(#ig)" />
                <Area type="monotone" dataKey="facebook" stroke="#2563eb" strokeWidth={2} fill="url(#fb)" />
                <Area type="monotone" dataKey="twitter" stroke="#06b6d4" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
            {!hasAnalytics && <div className="panel-empty"><BarChart3 size={20} /><strong>No performance data yet</strong><span>Analytics will appear after your first posts are published.</span></div>}
          </div>
        </article>

        <article className="panel workflow-panel">
          <div className="panel-header"><div><h2>Content workflow</h2><p>Current production pipeline</p></div></div>
          <div className="workflow-list">
            {[
              ["Drafts", summary.draftPosts, FileEdit, "#8b5cf6"],
              ["Needs review", summary.waitingApproval, Clock3, "#f59e0b"],
              ["Approved", summary.approved, CheckCircle2, "#10b981"],
              ["Scheduled", summary.scheduled, CalendarDays, "#3b82f6"],
            ].map(([label, value, Icon, color]) => {
              const WorkflowIcon = Icon as typeof FileEdit;
              return <div className="workflow-item" key={label as string}><span style={{ background: `${color}16`, color: color as string }}><WorkflowIcon size={16} /></span><p>{label as string}</p><strong>{value as number}</strong><i style={{ width: `${Math.min(100, (value as number) * 4)}%`, background: color as string }} /></div>;
            })}
          </div>
          <Link className="text-button" to="/approvals">View content pipeline <ArrowRight size={14} /></Link>
        </article>

        <article className="panel schedule-panel">
          <div className="panel-header"><div><h2>Today’s schedule</h2><p>{new Date().toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"})} · {scheduleRows.length ? `${scheduleRows.length} platform posts` : "No posts yet"}</p></div><Link className="text-button" to="/calendar">Open calendar <ArrowRight size={14} /></Link></div>
          <div className="schedule-list">
            {scheduleRows.map((post) => (
              <div className="schedule-row" key={post.id}>
                <div className="schedule-time"><strong>{post.time}</strong><span>Today</span></div>
                <div className="client-avatar" style={{ background: post.accent }}>{post.initials}</div>
                <div className="schedule-copy"><strong>{post.title}</strong><span>{post.client}</span></div>
                <PlatformBadge platform={post.platform} />
                <StatusBadge status={post.status} />
                <div className="post-menu-anchor">
                  <button type="button" className="more-button" aria-label={`Options for ${post.title}`} aria-expanded={openPostMenu === post.id} onClick={() => setOpenPostMenu((current) => current === post.id ? null : post.id)}>•••</button>
                  {openPostMenu === post.id && <div className="post-menu" role="menu"><Link role="menuitem" to="/approvals" onClick={() => setOpenPostMenu(null)}><FilePenLine size={13} /> Review post</Link><Link role="menuitem" to="/calendar" onClick={() => setOpenPostMenu(null)}><CalendarDays size={13} /> Reschedule</Link></div>}
                </div>
              </div>
            ))}
            {scheduleRows.length===0 && <div className="list-empty"><CalendarDays size={19} /><div><strong>Nothing scheduled yet</strong><span>Approved posts will appear here.</span></div></div>}
          </div>
        </article>

        <article className="panel activity-panel">
          <div className="panel-header"><div><h2>Recent activity</h2><p>Latest changes across all clients</p></div></div>
          <div className="activity-list">
            {recentRows.map((item) => {
              const Icon = activityIcon[item.kind];
              return <div className="activity-row" key={item.id}><span className={`activity-icon activity-${item.kind}`}><Icon size={14} /></span><div><strong>{item.title}</strong><p>{item.detail}</p></div><time>{item.time}</time></div>;
            })}
            {recentRows.length===0 && <div className="list-empty"><Clock3 size={19} /><div><strong>No activity yet</strong><span>Your local audit trail will appear here.</span></div></div>}
          </div>
          <Link className="text-button" to="/activity">View all activity <ArrowRight size={14} /></Link>
        </article>
      </section>

      <section className="insight-card">
        <div className="insight-art"><Instagram size={22} /><span /><span /><span /></div>
        <div><span className="eyebrow">{hasAnalytics ? "PERFORMANCE INSIGHT" : "LOCAL WORKSPACE READY"}</span><h3>{hasAnalytics ? "Your latest performance is ready for the ChatGPT improvement loop" : "Your local social-media workspace is ready"}</h3><p>{hasAnalytics ? "Prepare these stored results for ChatGPT to build the next improved content strategy." : "Add a client and create the first structured ChatGPT prompt; no AI API is required."}</p></div>
        <Link className="secondary-button" to={hasAnalytics ? "/analytics" : "/clients"}>{hasAnalytics ? <><Sparkles size={15} /> Analyse with ChatGPT</> : <><Users size={15} /> Open clients</>}</Link>
      </section>
    </div>
  );
}

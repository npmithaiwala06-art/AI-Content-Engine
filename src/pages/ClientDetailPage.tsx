import { Archive, ArrowLeft, BarChart3, CalendarDays, CheckCircle2, FileBarChart, FileEdit, Globe2, Image, Layers3, MapPin, Megaphone, Pencil, Send, Sparkles, Users, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ClientFormModal } from "../features/clients/ClientFormModal";
import { archiveClient, clientLogoUrl, getClient, platformLabels } from "../services/clients";
import { detailToInput, type ClientDetail } from "../types/client";

const tabs = ["Overview", "Brand Profile", "Social Accounts", "Campaigns", "Content", "Calendar", "Analytics", "Reports"] as const;
type Tab = (typeof tabs)[number];

const moduleMeta: Record<Exclude<Tab, "Overview" | "Brand Profile">, { icon: typeof Wifi; title: string; description: string; phase: string }> = {
  "Social Accounts": { icon: Wifi, title: "No social accounts connected", description: "The selected platforms are recorded. OAuth connection controls arrive in the Social Accounts phase.", phase: "Phase 10–12" },
  Campaigns: { icon: Megaphone, title: "No campaigns yet", description: "Campaigns will group goals, content, media, calendar, analytics and reporting for this client.", phase: "Phase 22" },
  Content: { icon: Layers3, title: "No client content yet", description: "Imported and manually created drafts will appear here with platform-specific versions.", phase: "Phase 3–5" },
  Calendar: { icon: CalendarDays, title: "No calendar items yet", description: "Approved and scheduled client content will appear in month, week and day views.", phase: "Phase 8" },
  Analytics: { icon: BarChart3, title: "No analytics collected", description: "Reach, engagement and platform performance will be stored locally after publishing.", phase: "Phase 15–17" },
  Reports: { icon: FileBarChart, title: "No reports generated", description: "Weekly, monthly, campaign and client reports will use this client’s local analytics.", phase: "Phase 20–21" },
};

function ChipList({ values, empty = "Not provided" }: { values: string[]; empty?: string }) {
  return <div className="detail-chips">{values.length ? values.map((value) => <span key={value}>{value}</span>) : <small>{empty}</small>}</div>;
}

export function ClientDetailPage() {
  const { clientId = "" } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientDetail>();
  const [tab, setTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const load = async () => { setLoading(true); setError(""); try { setClient(await getClient(clientId)); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [clientId]);

  if (loading) return <div className="client-detail-loading"><div /><div /><div /></div>;
  if (!client || error) return <div className="client-detail-error"><Users size={30} /><h2>Client could not be opened</h2><p>{error || "This client no longer exists."}</p><Link className="solid-button" to="/clients">Return to clients</Link></div>;

  const logo = clientLogoUrl(client.logoPath);
  const initials = (client.brandName || client.clientName).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const stats = [
    { label: "Draft posts", value: client.stats.draftPosts, icon: FileEdit, tone: "violet" },
    { label: "Approved", value: client.stats.approvedPosts, icon: CheckCircle2, tone: "green" },
    { label: "Scheduled", value: client.stats.scheduledPosts, icon: CalendarDays, tone: "blue" },
    { label: "Published", value: client.stats.publishedPosts, icon: Send, tone: "sky" },
    { label: "Connected", value: client.stats.connectedPlatforms, icon: Wifi, tone: "amber" },
  ];

  const archive = async () => { setArchiving(true); try { await archiveClient(client.id); navigate("/clients"); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setArchiving(false); } };

  return <div className="client-detail-page">
    <Link className="back-link" to="/clients"><ArrowLeft size={14} /> All clients</Link>
    <section className="client-hero panel">
      <div className="client-hero-logo">{logo ? <img src={logo} alt={`${client.brandName} logo`} /> : <span>{initials}</span>}</div>
      <div className="client-hero-copy"><div><h2>{client.brandName || client.clientName}</h2><span className={`client-status ${client.status}`}><i />{client.status}</span></div><p>{client.clientName}{client.companyName && client.companyName !== client.clientName ? ` · ${client.companyName}` : ""}</p><div className="hero-meta"><span><Layers3 size={12} />{client.industry || "Industry not set"}</span><span><MapPin size={12} />{client.location || "Location not set"}</span>{client.website && <span><Globe2 size={12} />{client.website.replace(/^https?:\/\//, "")}</span>}</div></div>
      <div className="client-hero-actions"><button type="button" className="ghost-button" disabled={archiving || client.status === "archived"} onClick={() => void archive()}><Archive size={14} />{archiving ? "Archiving…" : "Archive"}</button><button type="button" className="solid-button" onClick={() => setEditing(true)}><Pencil size={14} /> Edit client</button></div>
    </section>

    <nav className="client-tabs" aria-label="Client workspace sections">{tabs.map((item) => <button type="button" key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>

    {tab === "Overview" && <div className="client-overview">
      <section className="client-stats-grid">{stats.map(({ label, value, icon: Icon, tone }) => <article key={label}><span className={`detail-stat-icon ${tone}`}><Icon size={17} /></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</section>
      <div className="detail-columns">
        <article className="detail-card"><header><div><h3>Business overview</h3><p>Core information used across every workflow.</p></div><BuildingIcon /></header><dl><div><dt>Description</dt><dd>{client.businessDescription || "No business description yet."}</dd></div><div><dt>Target audience</dt><dd>{client.targetAudience || "Not provided"}</dd></div><div><dt>Posting frequency</dt><dd>{client.postingFrequency || "Not set"}</dd></div></dl></article>
        <article className="detail-card"><header><div><h3>Main platforms</h3><p>Planned channels for this client.</p></div><Wifi size={17} /></header><div className="detail-platform-list">{client.mainPlatforms.length ? client.mainPlatforms.map((platform) => <div key={platform}><span className={`platform-dot ${platform}`} /><strong>{platformLabels[platform]}</strong><small>Connection pending</small></div>) : <div className="inline-empty">No platforms selected</div>}</div></article>
        <article className="detail-card"><header><div><h3>Products & services</h3><p>Offerings supplied to ChatGPT prompt context.</p></div><Layers3 size={17} /></header><h4>Products</h4><ChipList values={client.products} /><h4>Services</h4><ChipList values={client.services} /></article>
        <article className="detail-card"><header><div><h3>Marketing direction</h3><p>Local memory for strategy and content planning.</p></div><Sparkles size={17} /></header><h4>Goals</h4><ChipList values={client.marketingGoals} /><h4>Competitors</h4><ChipList values={client.competitors} /></article>
      </div>
    </div>}

    {tab === "Brand Profile" && <div className="brand-profile-grid">
      <article className="brand-memory-card"><div className="memory-label">VOICE</div><h3>{client.brandProfile.brandVoice || "Not defined"}</h3><p>The writing tone included in every future ChatGPT content prompt.</p></article>
      <article className="brand-memory-card"><div className="memory-label">PREFERRED CTA</div><h3>{client.brandProfile.preferredCta || "Not defined"}</h3><p>The primary action to encourage across platform versions.</p></article>
      <article className="brand-detail-card"><h3>Brand personality</h3><ChipList values={client.brandProfile.brandPersonality} /></article>
      <article className="brand-detail-card"><h3>Content style</h3><p>{client.brandProfile.contentStyle || "Not defined"}</p></article>
      <article className="brand-detail-card"><h3>Colours</h3><div className="brand-colour-list">{client.brandProfile.brandColours.length ? client.brandProfile.brandColours.map((colour) => <div key={colour}><i style={{ background: colour }} /><span>{colour}</span></div>) : <small>Not provided</small>}</div></article>
      <article className="brand-detail-card"><h3>Fonts</h3><ChipList values={client.brandProfile.fonts} /></article>
      <article className="brand-detail-card"><h3>Keywords</h3><ChipList values={client.brandProfile.keywords} /></article>
      <article className="brand-detail-card avoid-card"><h3>Topics and language to avoid</h3><ChipList values={client.brandProfile.topicsToAvoid} empty="No restrictions recorded" /></article>
    </div>}

    {tab !== "Overview" && tab !== "Brand Profile" && (() => { const meta = moduleMeta[tab]; const Icon = meta.icon; return <section className="client-module-empty"><div><Icon size={27} /></div><span className="eyebrow">{meta.phase}</span><h3>{meta.title}</h3><p>{meta.description}</p></section>; })()}

    {editing && <ClientFormModal clientId={client.id} initialValue={detailToInput(client)} initialLogo={logo} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load(); }} />}
  </div>;
}

function BuildingIcon() { return <Image size={17} />; }

import { Archive, ArrowUpRight, Building2, ChevronDown, MapPin, MoreHorizontal, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ClientFormModal } from "../features/clients/ClientFormModal";
import { archiveClient, clientLogoUrl, deleteClient, getClient, listClients, platformLabels, restoreClient } from "../services/clients";
import { detailToInput, type ClientDetail, type ClientListOptions, type ClientSummary } from "../types/client";

type ConfirmAction = { kind: "archive" | "delete" | "restore"; client: ClientSummary };

function formatActivity(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} days ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function ClientLogo({ client }: { client: ClientSummary }) {
  const logo = clientLogoUrl(client.logoPath);
  const initials = (client.brandName || client.clientName).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <div className="client-list-logo">{logo ? <img src={logo} alt={`${client.brandName} logo`} /> : <span>{initials}</span>}</div>;
}

export function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [options, setOptions] = useState<ClientListOptions>({ search: "", filter: "active", sort: "recent" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDetail>();
  const [openMenu, setOpenMenu] = useState<string>();
  const [confirm, setConfirm] = useState<ConfirmAction>();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setClients(await listClients(options)); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }, [options]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);

  const startEdit = async (clientId: string) => {
    setOpenMenu(undefined);
    try { setEditing(await getClient(clientId)); setFormOpen(true); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const runConfirmedAction = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "archive") await archiveClient(confirm.client.id);
      if (confirm.kind === "restore") await restoreClient(confirm.client.id);
      if (confirm.kind === "delete") await deleteClient(confirm.client.id);
      setToast(confirm.kind === "delete" ? "Client permanently deleted" : confirm.kind === "archive" ? "Client archived" : "Client restored");
      setConfirm(undefined); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const totals = { clients: clients.length, accounts: clients.reduce((sum, client) => sum + client.socialAccountCount, 0), scheduled: clients.reduce((sum, client) => sum + client.scheduledPostCount, 0) };

  return <div className="clients-page">
    <section className="clients-toolbar-card">
      <div className="client-kpis"><div><span><Users size={16} /></span><p>Visible clients<strong>{totals.clients}</strong></p></div><div><span><Building2 size={16} /></span><p>Social accounts<strong>{totals.accounts}</strong></p></div><div><span><ArrowUpRight size={16} /></span><p>Scheduled posts<strong>{totals.scheduled}</strong></p></div></div>
      <button type="button" className="solid-button add-client-button" onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus size={16} /> Add Client</button>
    </section>

    <section className="client-directory panel">
      <div className="directory-header"><div><h2>Client directory</h2><p>Every client, brand profile and operating status in one local workspace.</p></div><div className="directory-controls"><label className="client-search"><Search size={15} /><input value={options.search} onChange={(event) => setOptions((current) => ({ ...current, search: event.target.value }))} placeholder="Search clients, brands or industries" aria-label="Search clients" /></label><label className="select-control"><SlidersHorizontal size={14} /><select aria-label="Filter clients" value={options.filter} onChange={(event) => setOptions((current) => ({ ...current, filter: event.target.value as ClientListOptions["filter"] }))}><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option><option value="all">All clients</option></select><ChevronDown size={12} /></label><label className="select-control"><select aria-label="Sort clients" value={options.sort} onChange={(event) => setOptions((current) => ({ ...current, sort: event.target.value as ClientListOptions["sort"] }))}><option value="recent">Recent activity</option><option value="name">Client name</option><option value="industry">Industry</option><option value="oldest">Oldest first</option></select><ChevronDown size={12} /></label></div></div>

      {error && <div className="page-error" role="alert">{error}<button type="button" onClick={() => void load()}>Retry</button></div>}
      <div className="client-table-header"><span>Client & brand</span><span>Industry</span><span>Platforms</span><span>Scheduled</span><span>Status</span><span>Last activity</span><span /></div>
      <div className="client-table-body">
        {loading && Array.from({ length: 4 }).map((_, index) => <div className="client-row client-row-loading" key={index}><i /><i /><i /><i /><i /></div>)}
        {!loading && clients.map((client) => <article className="client-row" key={client.id}>
          <Link className="client-identity" to={`/clients/${client.id}`}><ClientLogo client={client} /><div><strong>{client.clientName}</strong><span>{client.brandName}{client.location && <> · <MapPin size={9} /> {client.location}</>}</span></div></Link>
          <span className="client-industry">{client.industry || "Not set"}</span>
          <div className="client-platforms">{client.mainPlatforms.length ? client.mainPlatforms.slice(0, 4).map((platform) => <i key={platform} className={platform} title={platformLabels[platform]}>{platform[0].toUpperCase()}</i>) : <small>None selected</small>}<b>{client.socialAccountCount} connected</b></div>
          <span className="scheduled-count">{client.scheduledPostCount}<small>posts</small></span>
          <span className={`client-status ${client.status}`}><i />{client.status}</span>
          <time>{formatActivity(client.lastActivity)}</time>
          <div className="row-actions"><button type="button" aria-label={`Actions for ${client.clientName}`} aria-expanded={openMenu === client.id} onClick={() => setOpenMenu((current) => current === client.id ? undefined : client.id)}><MoreHorizontal size={16} /></button>{openMenu === client.id && <div className="row-action-menu" role="menu"><button type="button" onClick={() => navigate(`/clients/${client.id}`)}><ArrowUpRight size={13} /> Open workspace</button><button type="button" onClick={() => void startEdit(client.id)}><Pencil size={13} /> Edit client</button>{client.status === "archived" ? <button type="button" onClick={() => { setOpenMenu(undefined); setConfirm({ kind: "restore", client }); }}><RotateCcw size={13} /> Restore</button> : <button type="button" onClick={() => { setOpenMenu(undefined); setConfirm({ kind: "archive", client }); }}><Archive size={13} /> Archive</button>}<button type="button" className="danger" onClick={() => { setOpenMenu(undefined); setConfirm({ kind: "delete", client }); }}><Trash2 size={13} /> Delete permanently</button></div>}</div>
        </article>)}
        {!loading && clients.length === 0 && <div className="clients-empty"><div><Users size={26} /></div><h3>{options.search ? "No matching clients" : options.filter === "archived" ? "No archived clients" : "Create your first client"}</h3><p>{options.search ? "Try another search or change the current filter." : "Add business information and persistent Brand Memory to begin the local workflow."}</p>{!options.search && options.filter !== "archived" && <button type="button" className="solid-button" onClick={() => setFormOpen(true)}><Plus size={15} /> Add first client</button>}</div>}
      </div>
    </section>

    {formOpen && <ClientFormModal clientId={editing?.id} initialValue={editing ? detailToInput(editing) : undefined} initialLogo={clientLogoUrl(editing?.logoPath)} onClose={() => { setFormOpen(false); setEditing(undefined); }} onSaved={() => { const wasEditing = Boolean(editing); setFormOpen(false); setEditing(undefined); setToast(wasEditing ? "Client changes saved locally" : "Client created locally"); void load(); }} />}
    {confirm && <ConfirmDialog title={confirm.kind === "delete" ? `Delete ${confirm.client.clientName}?` : confirm.kind === "archive" ? `Archive ${confirm.client.clientName}?` : `Restore ${confirm.client.clientName}?`} description={confirm.kind === "delete" ? "This permanently removes the client, Brand Profile, related database records and locally stored client media. This cannot be undone." : confirm.kind === "archive" ? "The client will leave the active directory but all local data remains available under Archived." : "The client will return to the active directory."} confirmLabel={confirm.kind === "delete" ? "Delete permanently" : confirm.kind === "archive" ? "Archive client" : "Restore client"} danger={confirm.kind === "delete"} busy={busy} onCancel={() => setConfirm(undefined)} onConfirm={() => void runConfirmedAction()} />}
    {toast && <div className="toast-message" role="status"><span>✓</span>{toast}</div>}
  </div>;
}

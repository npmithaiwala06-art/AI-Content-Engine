import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { exportReleaseReadiness, getReleaseReadiness } from "../services/readiness";
import type { ReleaseReadiness } from "../types/readiness";

export function ReleaseReadinessPage() {
  const [audit, setAudit] = useState<ReleaseReadiness>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = async () => {
    setLoading(true); setError("");
    try { setAudit(await getReleaseReadiness()); }
    catch (reason) { setError(String(reason)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const exportAudit = async () => {
    try { setNotice(`Audit exported: ${await exportReleaseReadiness()}`); }
    catch (reason) { setError(String(reason)); }
  };
  const checklist = audit?.phases.flatMap((phase) => [
    `PHASE ${phase.phase} — ${phase.title}: ${phase.status === "complete" ? "COMPLETE" : "NEEDS EXTERNAL ACTION"}`,
    ...phase.checks.map((check) => `  ${check.status === "passed" ? "✓" : "○"} ${check.label}: ${check.detail}`),
  ]).join("\n") ?? "";

  if (loading) return <div className="queue-empty"><LoaderCircle className="spin"/> Running local release checks…</div>;
  return <div className="readiness-page">
    <section className="readiness-hero"><div><span>PHASES 12 · 35 · 37 · 40</span><h2>Release Readiness</h2><p>One honest screen for platform authorization, live publishing, Apple distribution and final approval.</p></div><div><strong>{audit?.completeCount ?? 0}/4</strong><small>phases complete</small></div></section>
    {error && <div className="studio-alert error"><AlertTriangle size={14}/><span>{error}</span></div>}
    {notice && <div className="studio-alert success"><CheckCircle2 size={14}/><span>{notice}</span></div>}
    <section className="readiness-toolbar panel"><div><ShieldCheck size={16}/><span><strong>SocialFlow OS {audit?.appVersion}</strong><small>Checked {audit ? new Date(audit.generatedAt).toLocaleString() : "now"}</small></span></div><button onClick={() => void navigator.clipboard.writeText(checklist)}><ClipboardCheck size={13}/> Copy checklist</button><button onClick={() => void exportAudit()}><Download size={13}/> Export JSON</button><button onClick={() => void refresh()}><RefreshCw size={13}/> Run checks again</button></section>
    <section className="readiness-grid">{audit?.phases.map((phase) => <article className={`panel ${phase.status}`} key={phase.phase}><header><i>{phase.status === "complete" ? <CheckCircle2/> : <AlertTriangle/>}</i><span><small>PHASE {phase.phase}</small><h3>{phase.title}</h3><p>{phase.summary}</p></span><b>{phase.status === "complete" ? "Complete" : "Action required"}</b></header><div>{phase.checks.map((check) => <section key={check.id}><i className={check.status}>{check.status === "passed" ? <CheckCircle2/> : <AlertTriangle/>}</i><span><strong>{check.label}</strong><small>{check.detail}</small></span>{check.actionRoute && <Link to={check.actionRoute}>Open <ExternalLink size={10}/></Link>}</section>)}</div></article>)}</section>
    <section className="readiness-boundary panel"><ShieldCheck size={18}/><div><strong>What SocialFlow can and cannot complete automatically</strong><p>Code, Mock Mode, diagnostics, retries, secure storage and release tooling are automated. Meta, Twitter, Google and Apple must still approve actions owned by their accounts. The app shows those as external actions instead of pretending they passed.</p></div></section>
  </div>;
}

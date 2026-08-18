import { BarChart3, ClipboardPaste, Copy, Download, FileJson, LineChart as LineIcon, LoaderCircle, RefreshCw, Sparkles, TrendingUp, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildAnalyticsPrompt, collectMockAnalytics, collectOfficialAnalytics, getAnalyticsDashboard, importAiRecommendations, parseRecommendations, recommendationExample } from "../services/analytics";
import { listClients, platformLabels } from "../services/clients";
import type { AnalyticsDashboard, RecommendationInput } from "../types/analytics";
import type { ClientSummary } from "../types/client";
import "../styles/recommendation-importer.css";

const blank: AnalyticsDashboard = { totalReach: 0, totalEngagement: 0, followersGained: 0, bestPlatform: "—", bestPost: "—", timeSeries: [], platformComparison: [], topPosts: [], contentTypePerformance: [] };
const past = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

export function AnalyticsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [client, setClient] = useState("");
  const [platform, setPlatform] = useState("all");
  const [start, setStart] = useState(past(30));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [prompt, setPrompt] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setData(await getAnalyticsDashboard({ clientId: client || undefined, platform, start, end })); }
    catch (reason) { setError(String(reason)); }
    finally { setLoading(false); }
  }, [client, platform, start, end]);

  useEffect(() => { listClients({ filter: "active", sort: "name" }).then(setClients); }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const analyse = async () => {
    if (!client) return setError("Select a client before building an analytics prompt.");
    try { setPrompt(await buildAnalyticsPrompt(client, start, end, clients.find((item) => item.id === client)?.clientName, data)); }
    catch (reason) { setError(String(reason)); }
  };
  const collectMock = async () => {
    try {
      const count = await collectMockAnalytics();
      setNotice(`${count} Mock analytics record${count === 1 ? "" : "s"} collected.`);
      await refresh();
    } catch (reason) { setError(String(reason)); }
  };
  const collectConnected = async () => {
    try {
      const result = await collectOfficialAnalytics();
      setNotice(`${result.collected} connected-platform record${result.collected === 1 ? "" : "s"} collected${result.failed ? `; ${result.failed} failed: ${result.errors.join(" · ")}` : "."}`);
      await refresh();
    } catch (reason) { setError(String(reason)); }
  };
  const format = (value: number) => value.toLocaleString();

  return <div className="analytics-page">
    <section className="analytics-hero"><div><span>PHASE 15–19 · MEASURE, LEARN, IMPROVE</span><h2>Analytics</h2><p>Platform performance is normalised and stored locally.</p></div><button onClick={() => void collectMock()}><Download size={13}/> Fetch Mock Analytics</button><button onClick={() => void collectConnected()}><Download size={13}/> Fetch Connected Analytics</button><button onClick={() => void analyse()}><Sparkles size={13}/> Analyse with ChatGPT</button></section>
    {error && <div className="studio-alert error"><span>{error}</span><button onClick={() => setError("")}><X size={13}/></button></div>}
    {notice && <div className="studio-alert success"><span>{notice}</span><button onClick={() => setNotice("")}><X size={13}/></button></div>}
    <section className="analytics-filters panel"><select value={client} onChange={(event) => setClient(event.target.value)}><option value="">All clients</option>{clients.map((item) => <option value={item.id} key={item.id}>{item.clientName}</option>)}</select><select value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="all">All platforms</option>{Object.entries(platformLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><input type="date" value={start} onChange={(event) => setStart(event.target.value)}/><span>to</span><input type="date" value={end} onChange={(event) => setEnd(event.target.value)}/><button onClick={() => void refresh()}><RefreshCw size={12}/></button></section>
    {loading ? <div className="analytics-loading"><LoaderCircle className="spin"/> Loading analytics…</div> : <>
      <section className="analytics-kpis"><Kpi icon={<TrendingUp/>} label="Total Reach" value={format(data.totalReach)}/><Kpi icon={<BarChart3/>} label="Total Engagement" value={format(data.totalEngagement)}/><Kpi icon={<Users/>} label="Followers Gained" value={format(data.followersGained)}/><Kpi icon={<LineIcon/>} label="Best Platform" value={platformLabels[data.bestPlatform as keyof typeof platformLabels] ?? data.bestPlatform}/><Kpi icon={<Sparkles/>} label="Best Post" value={data.bestPost}/></section>
      <section className="analytics-charts"><article className="panel"><header><h3>Reach & engagement over time</h3></header><ResponsiveContainer width="100%" height={240}><AreaChart data={data.timeSeries}><defs><linearGradient id="reach" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6d4bd2" stopOpacity={.3}/><stop offset="95%" stopColor="#6d4bd2" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" fontSize={7}/><YAxis fontSize={7}/><Tooltip/><Area type="monotone" dataKey="reach" stroke="#6d4bd2" fill="url(#reach)"/><Area type="monotone" dataKey="engagement" stroke="#16a27a" fill="transparent"/></AreaChart></ResponsiveContainer></article><article className="panel"><header><h3>Platform comparison</h3></header><ResponsiveContainer width="100%" height={240}><BarChart data={data.platformComparison}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="platform" fontSize={7}/><YAxis fontSize={7}/><Tooltip/><Bar dataKey="reach" fill="#5c78d5" radius={[4,4,0,0]}/><Bar dataKey="engagement" fill="#19a67d" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></article></section>
      <section className="analytics-bottom"><article className="panel"><header><h3>Top performing content</h3></header>{data.topPosts.length ? data.topPosts.map((post, index) => <div key={`${post.postId}-${post.platform}`}><b>{index + 1}</b><span><strong>{post.title}</strong><small>{post.platform} · {format(post.reach)} reach</small></span><em>{post.engagementRate.toFixed(1)}%</em></div>) : <p>No analytics yet. Publish a Mock or connected-platform post, then fetch analytics.</p>}</article><article className="panel"><header><h3>Content-type performance</h3></header>{data.contentTypePerformance.map((type) => <div key={type.platform}><span><strong>{type.platform.replaceAll("_", " ")}</strong><small>{type.posts} posts</small></span><em>{type.engagementRate.toFixed(1)}%</em></div>)}</article></section>
    </>}
    {prompt && <div className="studio-prompt-backdrop"><section className="analytics-prompt"><header><div><span>MANUAL CHATGPT ANALYSIS</span><h3>Analytics Prompt</h3></div><button onClick={() => setPrompt("")}><X size={15}/></button></header><pre>{prompt}</pre><footer><button onClick={() => void navigator.clipboard.writeText(prompt)}><Copy size={13}/> Copy Analytics Prompt</button><button onClick={() => { setPrompt(""); setImportOpen(true); }}>Import AI Recommendations</button></footer></section></div>}
    {importOpen && <RecommendationImporter clientId={client} start={start} end={end} onClose={() => setImportOpen(false)} onSaved={() => setNotice("AI recommendations saved. They will be included in future content prompts for this client.")}/>} 
  </div>;
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="panel"><i>{icon}</i><span>{label}</span><strong title={value}>{value}</strong></article>;
}

function RecommendationImporter({ clientId, start, end, onClose, onSaved }: { clientId: string; start: string; end: string; onClose: () => void; onSaved: () => void }) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<RecommendationInput>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const changeRaw = (value: string) => { setRaw(value); setParsed(undefined); setError(""); };
  const parse = () => {
    try { setParsed(parseRecommendations(raw, clientId, start, end)); setError(""); }
    catch (reason) { setParsed(undefined); setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const paste = async () => {
    try { changeRaw(await navigator.clipboard.readText()); }
    catch { setError("Clipboard access was blocked. Use Command + V inside the box instead."); }
  };
  const save = async () => {
    if (!parsed || saving) return;
    setSaving(true);
    try { await importAiRecommendations(parsed); onSaved(); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  };
  return <div className="studio-prompt-backdrop"><section className="recommendation-modal"><header><div><span>AI LEARNING LOOP</span><h3>Import ChatGPT Recommendations</h3></div><button aria-label="Close importer" onClick={onClose}><X size={15}/></button></header><div className="recommendation-body"><aside className="recommendation-help"><strong>What to paste here</strong><ol><li>Copy the Analytics Prompt.</li><li>Send that prompt to ChatGPT.</li><li>Paste ChatGPT's completed answer here.</li></ol><small>Do not paste the original analytics prompt back into this box.</small></aside>{error && <p role="alert">{error}</p>}<div className="recommendation-tools"><button type="button" onClick={() => void paste()}><ClipboardPaste size={12}/> Paste from Clipboard</button><button type="button" onClick={() => changeRaw(recommendationExample)}><FileJson size={12}/> Show Example Format</button></div><textarea aria-label="ChatGPT recommendation result" rows={12} value={raw} onChange={(event) => changeRaw(event.target.value)} placeholder="Paste ChatGPT's completed analysis here. The app will automatically find the recommendation JSON inside it."/>{parsed ? <article><strong>Ready to save</strong><span>{parsed.findings.length} findings</span><span>{parsed.successfulTopics.length} successful topics</span><span>{parsed.strategyRecommendations.length} strategy recommendations</span><span>{parsed.futureIdeas.length} future ideas</span></article> : <article className="recommendation-empty"><strong>Automatic validation</strong><span>The app accepts normal ChatGPT explanations, fenced JSON, snake_case keys and camelCase keys.</span><span>Your data stays on this Mac.</span></article>}</div><footer><button disabled={!raw.trim()} onClick={parse}>Parse & Preview</button><button disabled={!parsed || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save Recommendations"}</button></footer></section></div>;
}

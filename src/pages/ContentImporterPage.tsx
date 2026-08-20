import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ClipboardPaste, FileJson, Import, Info, LoaderCircle, Pencil, RotateCcw, Save, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ContentParseError, parseChatGptContent } from "../ai/contentParser";
import { checkContentImportDuplicates, saveContentImport, takeStagedGeneratedContent } from "../services/contentImport";
import { listClients, platformLabels } from "../services/clients";
import type { ClientSummary, PlatformKey } from "../types/client";
import type { ContentImportSaveResult, ImportedPlatformDraft, ImportedPostDraft, ParsedContentImport } from "../types/contentImport";
import { FriendlyTimePicker } from "../components/FriendlyTimePicker";

const exampleResult = JSON.stringify({
  format_version: "social_content_v1",
  client_id: "preview-abc-cafe",
  client_name: "ABC Cafe",
  campaign: null,
  posts: [{
    sequence: 1,
    title: "Weekend Coffee Offer",
    topic: "Weekend promotion",
    goal: "Increase weekend visitors",
    content_type: "image_post",
    scheduled_date: "2026-08-22",
    recommended_time: "10:00",
    timezone: "Asia/Kolkata",
    platforms: {
      instagram: { hook: "Your weekend deserves better coffee ☕", caption: "Slow mornings, fresh brews and your favourite people.", cta: "Visit us this weekend", hashtags: ["#SuratCafe", "#WeekendCoffee"], creative_idea: "A sunlit coffee table", image_prompt: "Warm editorial cafe photograph with specialty coffee" },
      facebook: { hook: "Planning a relaxed weekend?", caption: "Bring a friend and settle in with fresh coffee and brunch favourites.", cta: "Drop in this weekend", post_format: "image" },
      linkedin: { hook: "Great local brands create reasons to return.", caption: "This weekend, our team is focusing on a warm customer experience and a menu built for unhurried conversations.", cta: "Visit ABC Cafe in Surat", hashtags: ["#LocalBusiness", "#CustomerExperience"] },
    },
  }],
}, null, 2);

function platformContentLabel(version: ImportedPlatformDraft): string {
  return version.caption || version.description || version.title || "No content";
}

export function ContentImporterPage() {
  const [staged] = useState(() => takeStagedGeneratedContent());
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [clientId, setClientId] = useState(staged?.clientId ?? "");
  const [raw, setRaw] = useState(staged?.rawContent ?? "");
  const [parsed, setParsed] = useState<ParsedContentImport>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [activePlatforms, setActivePlatforms] = useState<Record<string, PlatformKey>>({});
  const [parseIssues, setParseIssues] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ContentImportSaveResult>();

  useEffect(() => {
    listClients({ filter: "active", sort: "name" }).then(setClients)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, []);

  const selectedCount = useMemo(() => [...selected].filter((id) => !duplicates.has(id)).length, [selected, duplicates]);

  const parseResult = async () => {
    setError(""); setParseIssues([]); setResult(undefined); setParsing(true);
    try {
      const content = parseChatGptContent(raw);
      let resolvedClient = clientId;
      if (!resolvedClient && content.clientIdHint && clients.some((client) => client.id === content.clientIdHint)) resolvedClient = content.clientIdHint;
      if (!resolvedClient && content.clientNameHint) resolvedClient = clients.find((client) => client.clientName.toLowerCase() === content.clientNameHint?.toLowerCase() || client.brandName.toLowerCase() === content.clientNameHint?.toLowerCase())?.id ?? "";
      if (!resolvedClient) throw new ContentParseError("Select the client that owns this content.", [content.clientNameHint ? `ChatGPT identified the client as ${content.clientNameHint}, but it did not match an active local client.` : "The result did not contain a matching client_id."]);
      setClientId(resolvedClient);
      const duplicateIds = await checkContentImportDuplicates(resolvedClient, content.posts);
      const duplicateSet = new Set(duplicateIds);
      setParsed(content);
      setDuplicates(duplicateSet);
      setSelected(new Set(content.posts.filter((post) => !duplicateSet.has(post.tempId)).map((post) => post.tempId)));
      setActivePlatforms(Object.fromEntries(content.posts.map((post) => [post.tempId, post.platforms[0].platform])));
    } catch (reason) {
      if (reason instanceof ContentParseError) { setError(reason.message); setParseIssues(reason.issues); }
      else setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setParsing(false); }
  };

  const updatePost = (tempId: string, patch: Partial<ImportedPostDraft>) => {
    setParsed((current) => current ? { ...current, posts: current.posts.map((post) => post.tempId === tempId ? { ...post, ...patch } : post) } : current);
  };

  const updateVersion = (tempId: string, platform: PlatformKey, patch: Partial<ImportedPlatformDraft>) => {
    setParsed((current) => current ? { ...current, posts: current.posts.map((post) => post.tempId === tempId ? { ...post, platforms: post.platforms.map((version) => version.platform === platform ? { ...version, ...patch } : version) } : post) } : current);
  };

  const toggleSelected = (tempId: string) => {
    if (duplicates.has(tempId)) return;
    setSelected((current) => { const next = new Set(current); next.has(tempId) ? next.delete(tempId) : next.add(tempId); return next; });
  };

  const saveDrafts = async () => {
    if (!parsed || !clientId || selectedCount === 0) return setError("Select at least one non-duplicate post.");
    setSaving(true); setError("");
    try {
      const saveResult = await saveContentImport({ clientId, aiPromptId: staged?.aiPromptId, rawContent: raw, parsedPostCount: parsed.posts.length, posts: parsed.posts.filter((post) => selected.has(post.tempId) && !duplicates.has(post.tempId)) });
      setResult(saveResult);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  };

  const reset = () => { setRaw(""); setParsed(undefined); setSelected(new Set()); setDuplicates(new Set()); setParseIssues([]); setError(""); setResult(undefined); };

  return <div className="content-importer-page">
    <Link className="back-link" to="/ai-workspace"><ArrowLeft size={13} /> AI Workspace</Link>
    <section className="importer-hero">
      <div><span className="eyebrow">PHASE 4 · CONTROLLED IMPORT</span><h2>Import ChatGPT content as local drafts</h2><p>Paste the structured response, review every platform version, then choose exactly what is saved. Imported content never skips human approval.</p></div>
      <div className="importer-law"><ShieldFlow /><span><strong>Safe destination</strong><small>Draft status only</small></span></div>
    </section>

    <section className="importer-stepper" aria-label="Content import steps">
      {["Paste & parse", "Review & edit", "Save drafts"].map((step, index) => <div key={step} className={(parsed ? 1 : 0) >= index || result ? "active" : ""}><b>{result && index === 2 ? <Check size={11} /> : index + 1}</b><span>{step}</span></div>)}
    </section>

    {error && <div className="importer-alert error" role="alert"><AlertTriangle size={16} /><div><strong>{error}</strong>{parseIssues.map((issue) => <span key={issue}>{issue}</span>)}</div><button type="button" onClick={() => { setError(""); setParseIssues([]); }}>Dismiss</button></div>}

    {!parsed && !result && <section className="import-paste-panel panel">
      <header><div><span>CHATGPT RESPONSE</span><h3>Paste structured content</h3><p>JSON fences and surrounding ChatGPT text are removed automatically.</p></div><FileJson size={21} /></header>
      <div className="import-source-grid">
        <label className="import-field"><span>Client <b>*</b></span><select aria-label="Import client" value={clientId} disabled={loading} onChange={(event) => setClientId(event.target.value)}><option value="">Auto-detect or select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.clientName} · {client.brandName}</option>)}</select></label>
        <div className="import-format-note"><Info size={15} /><span><strong>Expected format</strong><small>social_content_v1 from the Phase 3 prompt</small></span></div>
      </div>
      <label className="import-result-field"><span>ChatGPT result</span><textarea aria-label="ChatGPT result" value={raw} onChange={(event) => setRaw(event.target.value)} placeholder={'Paste the JSON result here…\n\n{\n  "format_version": "social_content_v1",\n  "posts": […]\n}'} /></label>
      <footer><button type="button" className="secondary-button" onClick={() => setRaw(exampleResult)}><ClipboardPaste size={14} /> Load safe example</button><span>{raw.length.toLocaleString()} characters · maximum 1 MB</span><button type="button" className="import-primary" disabled={parsing || !raw.trim()} onClick={() => void parseResult()}>{parsing ? <><LoaderCircle className="spin" size={15} /> Parsing…</> : <><Sparkles size={15} /> Parse and Preview</>}</button></footer>
    </section>}

    {parsed && !result && <>
      <section className="import-summary panel"><div><CheckCircle2 size={20} /><span><strong>{parsed.posts.length} {parsed.posts.length === 1 ? "post" : "posts"} parsed successfully</strong><small>{parsed.formatVersion} · {parsed.posts.reduce((sum, post) => sum + post.platforms.length, 0)} platform versions</small></span></div><div className="import-summary-counts"><span><b>{selectedCount}</b> selected</span><span className={duplicates.size ? "warning" : ""}><b>{duplicates.size}</b> duplicates</span></div><button type="button" className="secondary-button" onClick={reset}><RotateCcw size={13} /> Start over</button></section>
      {parsed.warnings.map((warning) => <div className="importer-alert warning" key={warning}><Info size={15} /><div><strong>Compatibility warning</strong><span>{warning}</span></div></div>)}
      <div className="import-review-list">
        {parsed.posts.map((post, index) => {
          const isDuplicate = duplicates.has(post.tempId); const isSelected = selected.has(post.tempId) && !isDuplicate; const activePlatform = activePlatforms[post.tempId] ?? post.platforms[0].platform; const version = post.platforms.find((item) => item.platform === activePlatform) ?? post.platforms[0];
          return <article className={`import-review-card panel ${isSelected ? "selected" : ""} ${isDuplicate ? "duplicate" : ""}`} key={post.tempId}>
            <header><button type="button" className="import-checkbox" aria-label={`${isSelected ? "Deselect" : "Select"} ${post.title}`} aria-pressed={isSelected} disabled={isDuplicate} onClick={() => toggleSelected(post.tempId)}>{isSelected && <Check size={13} />}</button><div><span>POST {index + 1}</span><input aria-label={`Title for post ${index + 1}`} value={post.title} onChange={(event) => updatePost(post.tempId, { title: event.target.value })} /></div>{isDuplicate ? <b className="duplicate-badge">Already imported</b> : <b className="draft-badge">Will save as Draft</b>}</header>
            <div className="import-post-fields"><label><span>Topic</span><input value={post.topic} aria-label={`Topic for post ${index + 1}`} onChange={(event) => updatePost(post.tempId, { topic: event.target.value })} /></label><label><span>Content type</span><select value={post.contentType} aria-label={`Content type for post ${index + 1}`} onChange={(event) => updatePost(post.tempId, { contentType: event.target.value })}><option value="image_post">Image post</option><option value="carousel">Carousel</option><option value="story">Story</option><option value="reel">Reel concept</option><option value="short_video">Short video</option><option value="long_video">Long video</option><option value="text_post">Text post</option><option value="mixed">Mixed</option></select></label><label><span>Date</span><input type="date" value={post.scheduledDate ?? ""} aria-label={`Date for post ${index + 1}`} onChange={(event) => updatePost(post.tempId, { scheduledDate: event.target.value || undefined })} /></label><label><span>Time</span><FriendlyTimePicker label="Recommended time" quickTimes={false} value={post.recommendedTime ?? ""} onChange={(recommendedTime) => updatePost(post.tempId, { recommendedTime: recommendedTime || undefined })} /></label></div>
            <nav className="import-platform-tabs" aria-label={`Platforms for ${post.title}`}>{post.platforms.map((item) => <button type="button" key={item.platform} className={item.platform === version.platform ? `active ${item.platform}` : ""} onClick={() => setActivePlatforms((current) => ({ ...current, [post.tempId]: item.platform }))}><i>{platformLabels[item.platform][0]}</i>{platformLabels[item.platform]}<small>{platformContentLabel(item).length} chars</small></button>)}</nav>
            <div className="import-version-editor"><label><span>{version.platform === "youtube" ? "Title / hook" : "Hook"}</span><input value={version.platform === "youtube" ? version.title : version.hook} onChange={(event) => updateVersion(post.tempId, version.platform, version.platform === "youtube" ? { title: event.target.value } : { hook: event.target.value })} /></label><label className="wide"><span>{version.platform === "youtube" ? "Description" : "Caption"}</span><textarea rows={4} value={version.platform === "youtube" ? version.description : version.caption} onChange={(event) => updateVersion(post.tempId, version.platform, version.platform === "youtube" ? { description: event.target.value } : { caption: event.target.value })} /></label><label><span>CTA</span><input value={version.cta} onChange={(event) => updateVersion(post.tempId, version.platform, { cta: event.target.value })} /></label><label><span>{version.platform === "youtube" ? "Keywords" : "Hashtags"}</span><input value={(version.platform === "youtube" ? version.keywords : version.hashtags).join(", ")} onChange={(event) => updateVersion(post.tempId, version.platform, version.platform === "youtube" ? { keywords: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } : { hashtags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label><label className="wide"><span>Creative idea</span><input value={version.creativeIdea || version.thumbnailConcept} onChange={(event) => updateVersion(post.tempId, version.platform, version.platform === "youtube" ? { thumbnailConcept: event.target.value } : { creativeIdea: event.target.value })} /></label></div>
          </article>;
        })}
      </div>
      <section className="import-save-bar"><div><strong>{selectedCount} posts ready</strong><span>{parsed.posts.reduce((sum, post) => sum + (selected.has(post.tempId) && !duplicates.has(post.tempId) ? post.platforms.length : 0), 0)} platform drafts · human approval remains required</span></div><button type="button" className="import-primary" disabled={saving || selectedCount === 0} onClick={() => void saveDrafts()}>{saving ? <><LoaderCircle className="spin" size={15} /> Saving locally…</> : <><Save size={15} /> Save Selected Drafts</>}</button></section>
    </>}

    {result && <section className="import-success panel"><div><CheckCircle2 size={31} /></div><span className="eyebrow">IMPORT COMPLETE</span><h2>{result.savedPostIds.length} {result.savedPostIds.length === 1 ? "draft" : "drafts"} saved locally</h2><p>{result.duplicateTempIds.length ? `${result.duplicateTempIds.length} duplicate items were safely skipped. ` : ""}Every imported post is still a Draft and must pass human approval before scheduling.</p><div><Link className="secondary-button" to="/create"><Pencil size={14} /> Open Content Studio</Link><button type="button" className="import-primary" onClick={reset}><Import size={14} /> Import Another Result</button></div></section>}
  </div>;
}

function ShieldFlow() { return <FileJson size={18} />; }

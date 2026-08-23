import {
  Bot,
  CalendarRange,
  Check,
  Clipboard,
  ClipboardPaste,
  Clock3,
  Copy,
  Download,
  FileJson,
  History,
  Info,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { buildChatGptPrompt } from "../ai/promptBuilder";
import { listAiRecommendations } from "../services/analytics";
import { manualChatGptProvider } from "../ai/manualProvider";
import { getClient, listClients, platformLabels } from "../services/clients";
import { listAiCampaignOptions, listAiPromptHistory, markAiPromptCopied, saveAiPrompt } from "../services/aiWorkspace";
import { generateWithLocalAi, getLocalAiStatus } from "../services/localAi";
import { getCodexStatus, stageCodexCreativeRequest, type CodexGenerationResult, type CodexStatus } from "../services/chatgpt";
import { stageGeneratedContent } from "../services/contentImport";
import { executeCampaignAutomation, type AutomationMode } from "../services/campaignAutomation";
import { listSocialAccounts } from "../services/automation";
import { listCampaigns } from "../services/campaigns";
import type { ClientDetail, ClientSummary, PlatformKey } from "../types/client";
import type { SocialAccountRecord } from "../types/automation";
import type { AiPromptHistoryItem, AiWorkspaceInput, CampaignOption, ManualAiWorkflow, PromptTemplateType } from "../types/aiWorkspace";
import type { LocalAiResult, LocalAiStatus } from "../services/localAi";
import { promptTemplates } from "../types/aiWorkspace";

const platformDescriptions: Record<PlatformKey, string> = {
  instagram: "Hooks, captions, hashtags and creative prompts",
  facebook: "Conversational community-focused content",
  twitter: "Concise real-time posts, hooks and image ideas",
  youtube: "Titles, descriptions, tags and thumbnails",
};

function toDateInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function addDays(start: string, days: number): string {
  const date = start ? new Date(`${start}T12:00:00`) : new Date();
  date.setDate(date.getDate() + Math.max(days - 1, 0));
  return toDateInput(date);
}

function initialInput(): AiWorkspaceInput {
  const startDate = toDateInput(new Date());
  return {
    clientId: "",
    campaignId: "",
    templateType: "7_day",
    goal: "",
    topic: "",
    contentType: "mixed",
    tone: "",
    platforms: [],
    postCount: 7,
    startDate,
    endDate: addDays(startDate, 7),
  };
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand?.("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access is unavailable");
}

function templateLabel(type: PromptTemplateType): string {
  return promptTemplates.find((template) => template.type === type)?.label ?? type;
}

export function AiWorkspacePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [client, setClient] = useState<ClientDetail>();
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [history, setHistory] = useState<AiPromptHistoryItem[]>([]);
  const [input, setInput] = useState<AiWorkspaceInput>(initialInput);
  const [generated, setGenerated] = useState<{ id: string; workflow: ManualAiWorkflow; clientName: string }>();
  const [loading, setLoading] = useState(true);
  const [clientLoading, setClientLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [localAi, setLocalAi] = useState<LocalAiStatus>();
  const [localModel, setLocalModel] = useState("");
  const [localResult, setLocalResult] = useState<LocalAiResult>();
  const [localGenerating, setLocalGenerating] = useState(false);
  const [codexStatus, setCodexStatus] = useState<CodexStatus>();
  const [codexResult, setCodexResult] = useState<CodexGenerationResult>();
  const [automationMode, setAutomationMode] = useState<AutomationMode>("manual_approval");
  const [automationRunning, setAutomationRunning] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountRecord[]>([]);
  const [accountIds, setAccountIds] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      listClients({ filter: "active", sort: "name" }),
      listAiPromptHistory(),
    ]).then(([clientRows, promptRows]) => {
      setClients(clientRows);
      setHistory(promptRows);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getLocalAiStatus()
      .then((status) => {
        setLocalAi(status);
        setLocalModel(status.models[0] ?? "");
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      );
  }, []);

  useEffect(() => {
    getCodexStatus()
      .then(setCodexStatus)
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === input.campaignId),
    [campaigns, input.campaignId],
  );

  const selectClient = async (clientId: string, requestedCampaignId = "") => {
    setInput((current) => ({ ...current, clientId, campaignId: "" }));
    setClient(undefined);
    setCampaigns([]);
    setSocialAccounts([]);
    setAccountIds({});
    setGenerated(undefined);
    setError("");
    if (!clientId) return;
    setClientLoading(true);
    try {
      const [detail, options, accounts, campaignRecords] = await Promise.all([getClient(clientId), listAiCampaignOptions(clientId), listSocialAccounts(clientId), listCampaigns(clientId, "all")]);
      const requestedCampaign = campaignRecords.find((campaign) => campaign.id === requestedCampaignId);
      setClient(detail);
      setCampaigns(options);
      setSocialAccounts(accounts);
      setInput((current) => ({
        ...current,
        clientId,
        campaignId: requestedCampaign?.id ?? "",
        goal: requestedCampaign?.objective || current.goal,
        topic: requestedCampaign?.description || requestedCampaign?.name || current.topic,
        tone: detail.brandProfile.brandVoice || current.tone,
        platforms: requestedCampaign?.platforms.length ? requestedCampaign.platforms : detail.mainPlatforms.length ? detail.mainPlatforms : current.platforms,
        startDate: requestedCampaign?.startDate || current.startDate,
        endDate: requestedCampaign?.endDate || current.endDate,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setClientLoading(false);
    }
  };

  const selectTemplate = (type: PromptTemplateType) => {
    const template = promptTemplates.find((item) => item.type === type)!;
    setInput((current) => ({
      ...current,
      templateType: type,
      postCount: template.posts,
      endDate: addDays(current.startDate, template.days),
    }));
    setGenerated(undefined);
  };

  useEffect(() => {
    const requestedClient = searchParams.get("client");
    const requestedCampaign = searchParams.get("campaign") ?? "";
    const requestedTemplate = searchParams.get("template") as PromptTemplateType | null;
    if (requestedClient && clients.some((item) => item.id === requestedClient) && (requestedClient !== input.clientId || requestedCampaign !== input.campaignId)) void selectClient(requestedClient, requestedCampaign);
    if (requestedTemplate && promptTemplates.some((item) => item.type === requestedTemplate) && requestedTemplate !== input.templateType) selectTemplate(requestedTemplate);
  }, [clients, searchParams]);

  const togglePlatform = (platform: PlatformKey) => {
    setInput((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }));
    setGenerated(undefined);
  };

  const generatePrompt = async () => {
    setError("");
    setNotice("");
    setLocalResult(undefined);
    setCodexResult(undefined);
    if (!client) return setError("Select a client so the Brand Profile can be included.");
    if (!input.goal.trim()) return setError("Enter the content goal.");
    if (!input.topic.trim()) return setError("Enter the topic or campaign idea.");
    if (!input.tone.trim()) return setError("Enter the requested tone.");
    if (!input.platforms.length) return setError("Select at least one social platform.");
    if (input.startDate && input.endDate && input.startDate > input.endDate) return setError("End date cannot be before start date.");

    setGenerating(true);
    try {
      const recommendations = await listAiRecommendations(client.id);
      const prompt = buildChatGptPrompt({ client, campaign: selectedCampaign, input, recommendations });
      const workflow = manualChatGptProvider.prepare(prompt);
      const id = await saveAiPrompt({
        clientId: client.id,
        campaignId: selectedCampaign?.id,
        templateType: input.templateType,
        goal: input.goal,
        topic: input.topic,
        contentType: input.contentType,
        tone: input.tone,
        platforms: input.platforms,
        postCount: input.postCount,
        startDate: input.startDate || undefined,
        endDate: input.endDate || undefined,
        promptText: prompt,
      });
      setGenerated({ id, workflow, clientName: client.clientName });
      setHistory(await listAiPromptHistory());
      const videoTypes = new Set(["reel", "short_video", "long_video"]);
      const imageTypes = new Set(["image_post", "carousel"]);
      stageCodexCreativeRequest({
        prompt,
        clientName: client.clientName,
        goal: input.goal.trim(),
        topic: input.topic.trim(),
        suggestedMode: videoTypes.has(input.contentType) ? "video" : imageTypes.has(input.contentType) ? "image" : "both",
      });
      navigate("/chatgpt");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setGenerating(false);
    }
  };

  const copyPrompt = async (promptId: string, promptText: string) => {
    setError("");
    try {
      await copyText(promptText);
      await markAiPromptCopied(promptId);
      setCopiedId(promptId);
      setNotice("Prompt copied — paste it into ChatGPT");
      setHistory(await listAiPromptHistory());
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const downloadPrompt = () => {
    if (!generated) return;
    const blob = new Blob([generated.workflow.prompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${generated.clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${input.templateType}-chatgpt-prompt.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Prompt exported as a local text file");
  };

  const generateLocally = async () => {
    if (!generated || !localModel) return;
    setError("");
    setLocalResult(undefined);
    setLocalGenerating(true);
    try {
      setLocalResult(
        await generateWithLocalAi(localModel, generated.workflow.prompt),
      );
      setNotice("Local LLM result created — review it before importing");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLocalGenerating(false);
    }
  };

  const reviewCodexResult = () => {
    if (!generated || !codexResult || !client) return;
    stageGeneratedContent({
      rawContent: codexResult.content,
      clientId: client.id,
      campaignId: selectedCampaign?.id,
      aiPromptId: generated.id,
    });
    navigate("/ai-workspace/import");
  };

  const startAutomation = async () => {
    setError("");
    setNotice("");
    if (!client) return setError("Select a client so the Brand Profile can be included.");
    if (!codexStatus?.authenticated) return setError("Connect ChatGPT before starting automation.");
    if (!input.goal.trim()) return setError("Enter the content goal.");
    if (!input.topic.trim()) return setError("Enter the topic or campaign idea.");
    if (!input.tone.trim()) return setError("Enter the requested tone.");
    if (!input.platforms.length) return setError("Select at least one social platform.");
    if (input.startDate && input.endDate && input.startDate > input.endDate) return setError("End date cannot be before start date.");
    if (automationMode !== "manual_approval") {
      const missingPlatform = input.platforms.find((platform) => !accountIds[platform]);
      if (missingPlatform) return setError(`Select a connected ${platformLabels[missingPlatform]} account before starting automated scheduling.`);
    }

    setAutomationRunning(true);
    try {
      const recommendations = await listAiRecommendations(client.id);
      const result = await executeCampaignAutomation({
        client,
        campaign: selectedCampaign,
        input,
        recommendations,
        mode: automationMode,
        accountIds,
      });
      setHistory(await listAiPromptHistory());
      const duplicateText = result.duplicateTempIds.length ? ` ${result.duplicateTempIds.length} duplicate item(s) were skipped.` : "";
      const outcome = automationMode === "manual_approval" ? "saved as drafts for review" : "approved and added to the persistent publishing queue";
      setNotice(`${result.savedPostIds.length} campaign post(s) ${outcome}.${duplicateText}`);
      if (result.savedPostIds.length) navigate(automationMode === "manual_approval" ? "/create?status=draft" : "/calendar");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setAutomationRunning(false);
    }
  };

  return (
    <div className="ai-workspace-page">
      <section className="ai-workspace-hero">
        <div className="ai-hero-icon"><Sparkles size={22} /></div>
        <div>
          <span className="eyebrow">CONNECTED CONTENT ENGINE · NO API KEY</span>
          <h2>Turn local Brand Memory into finished social content</h2>
          <p>When ChatGPT is connected, SocialFlow sends the structured brief to the official Codex client and returns the result here automatically.</p>
        </div>
        <div className="ai-hero-actions"><div className="ai-privacy-badge"><ShieldCheck size={15} /><span><strong>No API key</strong><small>{codexStatus?.authenticated ? "ChatGPT connected" : "Manual fallback available"}</small></span></div><Link to="/chatgpt"><Bot size={14} /> {codexStatus?.authenticated ? "Codex Connected" : "Connect ChatGPT"}</Link></div>
      </section>

      <section className="ai-workflow-strip" aria-label="Connected content workflow">
        {["Configure brief", "Generate with Codex", "Review content", "Save local drafts"].map((step, index) => (
          <div key={step}><b>{index + 1}</b><span>{step}</span>{index < 3 && <i>→</i>}</div>
        ))}
      </section>

      <section className={`codex-ai-status${codexStatus?.authenticated ? " ready" : ""}`}>
        {codexStatus?.authenticated ? <Check size={18} /> : <Sparkles size={18} />}
        <div><strong>{codexStatus?.authenticated ? "ChatGPT subscription connected" : "ChatGPT connection optional"}</strong><small>{codexStatus?.detail ?? "Checking the official Codex client…"}</small></div>
        <Link to="/chatgpt">{codexStatus?.authenticated ? "Manage connection" : "Connect ChatGPT"}</Link>
      </section>

      <section className={`local-ai-status${localAi?.running && localAi.models.length ? " ready" : ""}`}>
        <Bot size={18} />
        <div>
          <strong>{localAi?.running && localAi.models.length ? "Local LLM ready" : "Local LLM optional"}</strong>
          <small>{localAi?.detail ?? "Checking this Mac for a local model…"}</small>
        </div>
        {localAi?.models.length ? <select aria-label="Local LLM model" value={localModel} onChange={(event) => setLocalModel(event.target.value)}>{localAi.models.map((model) => <option key={model} value={model}>{model}</option>)}</select> : null}
        <button type="button" className="local-ai-generate" disabled={!generated || !localModel || localGenerating} onClick={() => void generateLocally()}>{localGenerating ? <><LoaderCircle size={13} className="spin" /> Generating locally…</> : <><Bot size={13} /> Generate locally</>}</button>
      </section>

      {error && <div className="ai-page-alert error" role="alert"><Info size={15} /><span>{error}</span><button type="button" onClick={() => setError("")}>Dismiss</button></div>}
      {notice && <div className="ai-page-alert success" role="status"><Check size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}

      <div className="ai-workspace-grid">
        <section className="ai-config-panel panel">
          <header className="ai-panel-header"><div><span>CONTENT BRIEF</span><h3>Configure ChatGPT prompt</h3><p>Brand information loads automatically from the selected client.</p></div><WandSparkles size={20} /></header>

          <div className="ai-section-block">
            <label className="ai-field"><span>Client <b>*</b></span><select aria-label="AI Workspace client" value={input.clientId} disabled={loading} onChange={(event) => void selectClient(event.target.value)}><option value="">Select a client</option>{clients.map((row) => <option key={row.id} value={row.id}>{row.clientName} · {row.brandName}</option>)}</select></label>
            {clientLoading && <div className="ai-inline-loading"><LoaderCircle size={14} className="spin" /> Loading Brand Profile…</div>}
            {client && <div className="brand-context-card"><div className="brand-context-avatar">{client.brandName.slice(0, 2).toUpperCase()}</div><div><strong>{client.brandName}</strong><span>{client.industry || "Industry not set"} · {client.brandProfile.brandVoice || "Voice not set"}</span></div><small>{client.brandProfile.keywords.length} keywords</small></div>}
            <label className="ai-field"><span>Campaign <em>Optional</em></span><select aria-label="AI Workspace campaign" value={input.campaignId} disabled={!client || campaigns.length === 0} onChange={(event) => setInput((current) => ({ ...current, campaignId: event.target.value }))}><option value="">{campaigns.length ? "No campaign" : "No campaigns available yet"}</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select><small>Campaign creation remains in its later dedicated phase.</small></label>
          </div>

          <div className="ai-section-block">
            <div className="ai-section-title"><span>Prompt template</span><small>Choose the planning window</small></div>
            <div className="prompt-template-grid">
              {promptTemplates.map((template) => <button type="button" key={template.type} className={input.templateType === template.type ? "selected" : ""} aria-pressed={input.templateType === template.type} onClick={() => selectTemplate(template.type)}><strong>{template.label}</strong><span>{template.description}</span>{input.templateType === template.type && <Check size={13} />}</button>)}
            </div>
          </div>

          <div className="ai-section-block ai-form-grid">
            <label className="ai-field field-wide"><span>Goal <b>*</b></span><textarea aria-label="Content goal" rows={2} value={input.goal} onChange={(event) => { setInput((current) => ({ ...current, goal: event.target.value })); setGenerated(undefined); }} placeholder="Increase weekend visitors and local awareness" /></label>
            <label className="ai-field field-wide"><span>Topic or core idea <b>*</b></span><textarea aria-label="Content topic" rows={2} value={input.topic} onChange={(event) => { setInput((current) => ({ ...current, topic: event.target.value })); setGenerated(undefined); }} placeholder="Promote our weekend coffee and brunch offer" /></label>
            <label className="ai-field"><span>Content type</span><select aria-label="Content type" value={input.contentType} onChange={(event) => setInput((current) => ({ ...current, contentType: event.target.value }))}><option value="mixed">Mixed content plan</option><option value="image_post">Image posts</option><option value="carousel">Carousels</option><option value="reel">Reel concepts</option><option value="short_video">Short-form video</option><option value="story">Stories</option><option value="text_post">Text posts</option><option value="long_video">Long-form video</option></select></label>
            <label className="ai-field"><span>Number of posts</span><input aria-label="Number of posts" type="number" min={1} max={100} value={input.postCount} onChange={(event) => setInput((current) => ({ ...current, postCount: Math.min(100, Math.max(1, Number(event.target.value) || 1)) }))} /></label>
            <label className="ai-field field-wide"><span>Tone <b>*</b></span><input aria-label="Requested tone" value={input.tone} onChange={(event) => setInput((current) => ({ ...current, tone: event.target.value }))} placeholder="Friendly, energetic and local" /></label>
          </div>

          <div className="ai-section-block">
            <div className="ai-section-title"><span>Platforms <b>*</b></span><small>Create once, adapt independently</small></div>
            <div className="ai-platform-grid">
              {(Object.keys(platformLabels) as PlatformKey[]).map((platform) => <button type="button" key={platform} className={input.platforms.includes(platform) ? `selected ${platform}` : ""} aria-pressed={input.platforms.includes(platform)} onClick={() => togglePlatform(platform)}><i>{platformLabels[platform].slice(0, 1)}</i><span><strong>{platformLabels[platform]}</strong><small>{platformDescriptions[platform]}</small></span>{input.platforms.includes(platform) && <Check size={14} />}</button>)}
            </div>
          </div>

          <div className="ai-section-block ai-form-grid">
            <div className="ai-section-title field-wide"><span>Date range</span><small>Publishing recommendations use Asia/Kolkata</small></div>
            <label className="ai-field"><span>Start date</span><input aria-label="Prompt start date" type="date" value={input.startDate} onChange={(event) => setInput((current) => ({ ...current, startDate: event.target.value }))} /></label>
            <label className="ai-field"><span>End date</span><input aria-label="Prompt end date" type="date" value={input.endDate} onChange={(event) => setInput((current) => ({ ...current, endDate: event.target.value }))} /></label>
            <label className="ai-field field-wide"><span>Automation mode</span><select aria-label="Automation mode" value={automationMode} onChange={(event) => setAutomationMode(event.target.value as AutomationMode)}><option value="manual_approval">Manual Approval</option><option value="auto_schedule">Auto Schedule</option><option value="full_autopilot">Full Autopilot</option></select><small>Manual Approval keeps drafts for review. Automated modes require connected publishing accounts before posts can leave this Mac.</small></label>
            {automationMode !== "manual_approval" && input.platforms.map((platform) => (
              <label className="ai-field field-wide" key={platform}><span>{platformLabels[platform]} publishing account <b>*</b></span><select aria-label={`${platformLabels[platform]} automation account`} value={accountIds[platform] ?? ""} onChange={(event) => setAccountIds((current) => ({ ...current, [platform]: event.target.value }))}><option value="">Select connected account</option>{socialAccounts.filter((account) => account.platform === platform && account.connectionStatus === "connected").map((account) => <option key={account.id} value={account.id}>{account.accountName}</option>)}</select></label>
            ))}
          </div>

          <footer className="ai-config-footer"><span><ShieldCheck size={14} /> Saves prompt history locally</span><button type="button" className="secondary-button" disabled={generating || automationRunning || loading || clientLoading} onClick={() => void generatePrompt()}>{generating ? <><LoaderCircle size={15} className="spin" /> Preparing brief…</> : <><Sparkles size={15} /> Generate Content</>}</button><button type="button" className="ai-generate-button" disabled={generating || automationRunning || loading || clientLoading} onClick={() => void startAutomation()}>{automationRunning ? <><LoaderCircle size={15} className="spin" /> Automating…</> : <><WandSparkles size={15} /> Start Automation</>}</button></footer>
        </section>

        <section className="ai-preview-panel panel">
          <header className="ai-panel-header"><div><span>STRUCTURED OUTPUT</span><h3>{codexResult ? "Generated content" : "Content brief preview"}</h3><p>{codexStatus?.authenticated ? "Sent only when you press Generate Content." : "Connect ChatGPT for automatic generation."}</p></div><FileJson size={20} /></header>
          {!generated ? <div className="ai-prompt-empty"><div><Clipboard size={24} /></div><h3>Your generated prompt will appear here</h3><p>Select a client, define the brief and choose platforms. The prompt will include Brand Memory and a strict JSON response format.</p><ul><li><Check size={12} /> Brand voice and audience</li><li><Check size={12} /> Platform-native requirements</li><li><Check size={12} /> Import-ready JSON format</li></ul></div> : <>
            <div className="ai-prompt-actions"><div><span>{generated.workflow.outputFormat}</span><small>{generated.workflow.prompt.length.toLocaleString()} characters · manual workflow</small></div><button type="button" className="secondary-button" onClick={downloadPrompt}><Download size={14} /> Export</button><button type="button" className="copy-prompt-button" onClick={() => void copyPrompt(generated.id, generated.workflow.prompt)}>{copiedId === generated.id ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Prompt</>}</button></div>
            <pre className="ai-prompt-preview" aria-label="Generated ChatGPT prompt">{generated.workflow.prompt}</pre>
            {codexResult ? <article className="codex-ai-result"><header><strong>Generated with your ChatGPT subscription</strong><span>{Math.max(1, Math.round(codexResult.elapsedMs / 1000))}s</span></header><pre>{codexResult.content}</pre><footer><button type="button" onClick={() => void copyText(codexResult.content)}><Copy size={12} /> Copy result</button><button type="button" className="review-import-button" onClick={reviewCodexResult}><ClipboardPaste size={12} /> Review &amp; import drafts</button></footer></article> : <div className="manual-workflow-card"><Info size={16} /><div><strong>{codexStatus?.authenticated ? "Generation is ready" : "Manual fallback"}</strong><ol>{generated.workflow.steps.map((step) => <li key={step}>{step}</li>)}</ol></div></div>}
            {localResult && <article className="local-ai-result"><header><strong>Generated locally with {localResult.model}</strong><span>No AI API key</span></header><pre>{localResult.content}</pre><footer><button type="button" onClick={() => void copyText(localResult.content)}><Copy size={12} /> Copy result</button><Link to="/ai-workspace/import"><ClipboardPaste size={12} /> Open importer</Link></footer></article>}
          </>}
        </section>
      </div>

      <section className="ai-history-panel panel">
        <header className="ai-panel-header"><div><span>LOCAL HISTORY</span><h3>Recent generated prompts</h3><p>Reusable prompt records stored only on this Mac.</p></div><History size={20} /></header>
        {loading ? <div className="ai-history-loading"><LoaderCircle className="spin" size={18} /> Loading prompt history…</div> : history.length === 0 ? <div className="ai-history-empty"><Clock3 size={19} /><span><strong>No prompt history yet</strong><small>Your first generated prompt will be saved here.</small></span></div> : <div className="ai-history-list">{history.slice(0, 8).map((item) => <article key={item.id}><div className="history-template-icon"><CalendarRange size={16} /></div><div className="history-main"><strong>{item.topic}</strong><span>{item.clientName} · {templateLabel(item.templateType)} · {item.postCount} {item.postCount === 1 ? "post" : "posts"}</span><small>{item.platforms.map((platform) => platformLabels[platform]).join(" + ")}</small></div><div className="history-meta"><time>{new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time><small>{item.copyCount} {item.copyCount === 1 ? "copy" : "copies"}</small></div><button type="button" aria-label={`Copy prompt for ${item.topic}`} onClick={() => void copyPrompt(item.id, item.promptText)}>{copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}</button></article>)}</div>}
      </section>
    </div>
  );
}

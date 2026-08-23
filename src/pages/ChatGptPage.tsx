import {
  CalendarDays,
  Check,
  Clapperboard,
  Copy,
  Download,
  Eye,
  Image,
  KeyRound,
  Layers3,
  Lightbulb,
  LoaderCircle,
  LogIn,
  LogOut,
  MessageSquareText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Video,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { buildMediaCreativePrompt } from "../ai/mediaCreativePrompt";
import {
  connectCodex,
  disconnectCodex,
  generateWithCodex,
  getCodexStatus,
  takeStagedCodexCreativeRequest,
  type CodexCreativeMode,
  type CodexGenerationResult,
  type CodexStatus,
} from "../services/chatgpt";
import {
  parseCreativePackage,
  releaseGeneratedMedia,
  renderCreativeMedia,
  type GeneratedCreativeMedia,
} from "../services/localCreativeRenderer";
import "../styles/local-creative-media.css";

const creativeModes: Array<{ mode: CodexCreativeMode; title: string; description: string; icon: typeof Image }> = [
  { mode: "image", title: "Create image", description: "Rendered advertising image", icon: Image },
  { mode: "video", title: "Create video", description: "Playable vertical motion video", icon: Clapperboard },
  { mode: "both", title: "Image + video", description: "Rendered image and video campaign", icon: Layers3 },
];

const starterPrompts = [
  {
    title: "Write captions",
    description: "Create platform-native captions with hooks, CTAs and hashtags.",
    icon: MessageSquareText,
    prompt: "Create five platform-specific social captions for this campaign: ",
  },
  {
    title: "Script a reel",
    description: "Build a concise hook, shot list, voiceover and closing CTA.",
    icon: Video,
    prompt: "Write a 30-second vertical-video script with a hook, scenes, voiceover, on-screen text and CTA for: ",
  },
  {
    title: "Plan a calendar",
    description: "Turn campaign goals into a balanced publishing schedule.",
    icon: CalendarDays,
    prompt: "Create a practical 30-day social content calendar for this brand and goal: ",
  },
  {
    title: "Generate ideas",
    description: "Explore fresh content pillars, angles and repeatable series.",
    icon: Lightbulb,
    prompt: "Generate original social-media content ideas grouped by funnel stage for: ",
  },
  {
    title: "Repurpose content",
    description: "Adapt one source into posts for several social platforms.",
    icon: WandSparkles,
    prompt: "Repurpose the following source into distinct Instagram, Facebook, Twitter and YouTube content: ",
  },
];

const initialStatus: CodexStatus = {
  installed: false,
  authenticated: false,
  loginInProgress: false,
  provider: "Official Codex client",
  detail: "Checking the local Codex connection…",
};

export function ChatGptPage() {
  const [status, setStatus] = useState<CodexStatus>(initialStatus);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busy, setBusy] = useState<"connect" | "disconnect" | "generate" | null>(null);
  const [request, setRequest] = useState("");
  const [creativeMode, setCreativeMode] = useState<CodexCreativeMode>("image");
  const [result, setResult] = useState<CodexGenerationResult>();
  const [media, setMedia] = useState<GeneratedCreativeMedia[]>([]);
  const [viewingMedia, setViewingMedia] = useState<GeneratedCreativeMedia>();
  const [mediaProgress, setMediaProgress] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refreshStatus = async () => {
    try {
      const next = await getCodexStatus();
      setStatus(next);
      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return undefined;
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    const staged = takeStagedCodexCreativeRequest();
    if (staged) {
      setRequest(staged.prompt);
      setCreativeMode(staged.suggestedMode);
      setNotice(`${staged.clientName} brief loaded automatically — choose the media you want and create.`);
    }
    void refreshStatus();
  }, []);

  useEffect(() => {
    if (!status.loginInProgress) return;
    const timer = window.setInterval(() => void refreshStatus(), 1500);
    return () => window.clearInterval(timer);
  }, [status.loginInProgress]);

  useEffect(() => () => releaseGeneratedMedia(media), [media]);

  const connect = async () => {
    setBusy("connect");
    setError("");
    setNotice("");
    try {
      await connectCodex();
      setStatus((current) => ({
        ...current,
        installed: true,
        loginInProgress: true,
        detail: "Complete the official OpenAI sign-in in your browser.",
      }));
      setNotice("Official OpenAI sign-in started in your browser.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setError("");
    setNotice("");
    try {
      await disconnectCodex();
      await refreshStatus();
      setResult(undefined);
      setMedia([]);
      setNotice("The local Codex connection was removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (!request.trim()) {
      setError("Describe the content you want SocialFlow to create.");
      return;
    }
    setBusy("generate");
    setError("");
    setNotice("");
    setResult(undefined);
    setMedia([]);
    setMediaProgress("Codex is turning the brief into a media creative…");
    try {
      const sourceBrief = request.trim();
      const generated = await generateWithCodex(buildMediaCreativePrompt(creativeMode, sourceBrief));
      setResult(generated);
      const creative = parseCreativePackage(generated.content, sourceBrief);
      const generatedMedia = await renderCreativeMedia(creative, creativeMode, setMediaProgress);
      setMedia(generatedMedia);
      const outputLabel = creativeMode === "both" ? "image and video" : creativeMode;
      setNotice(`Your ${outputLabel} advertisement is ready inside SocialFlow.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setMediaProgress("");
      setBusy(null);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const downloadMedia = (item: GeneratedCreativeMedia) => {
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setNotice(`${item.kind === "image" ? "Image" : "Video"} saved to your Downloads folder.`);
  };

  return (
    <div className="chatgpt-page">
      <section className="chatgpt-hero">
        <div className="chatgpt-mark"><Sparkles size={26} /></div>
        <div>
          <span>CHATGPT SUBSCRIPTION CONNECTION</span>
          <h2>Use Codex directly inside SocialFlow OS</h2>
          <p>Connect once through OpenAI, then generate captions, scripts, calendars and campaign ideas without supplying an API key or opening ChatGPT inside SocialFlow.</p>
        </div>
        {status.authenticated ? (
          <button type="button" className="connected" disabled><Check size={15} /> Connected</button>
        ) : (
          <button type="button" onClick={() => void connect()} disabled={busy !== null || loadingStatus || status.loginInProgress}>
            {busy === "connect" || status.loginInProgress ? <LoaderCircle className="spin" size={15} /> : <LogIn size={15} />}
            {status.loginInProgress ? "Waiting for sign-in…" : "Connect ChatGPT"}
          </button>
        )}
      </section>

      {notice && <div className="chatgpt-notice success" role="status"><Check size={14} />{notice}</div>}
      {error && <div className="chatgpt-notice error" role="alert">{error}</div>}

      <div className="chatgpt-grid">
        <section className="panel chatgpt-launch-card codex-compose-card">
          <header>
            <div><Sparkles size={18} /></div>
            <span><strong>SocialFlow content assistant</strong><small>Runs through the official local Codex client</small></span>
            <button type="button" className="chatgpt-refresh" aria-label="Refresh Codex status" onClick={() => void refreshStatus()} disabled={loadingStatus}><RefreshCcw className={loadingStatus ? "spin" : ""} size={13} /></button>
          </header>
          <label className="codex-request">
            <span>What should SocialFlow create?</span>
            <textarea value={request} onChange={(event) => setRequest(event.target.value)} placeholder="Example: Write a 30-second Instagram reel script for ABC Cafe promoting its weekend cold brew offer to young professionals in Surat." />
          </label>
          <fieldset className="codex-creative-modes">
            <legend>Choose what Codex should create</legend>
            <div>
              {creativeModes.map(({ mode, title, description, icon: Icon }) => (
                <button type="button" key={mode} className={creativeMode === mode ? "selected" : ""} aria-pressed={creativeMode === mode} onClick={() => setCreativeMode(mode)}>
                  <Icon size={16} />
                  <span><strong>{title}</strong><small>{description}</small></span>
                  {creativeMode === mode && <Check size={13} />}
                </button>
              ))}
            </div>
            <small>Codex creates the creative direction, then SocialFlow shows the image or video as a temporary preview without saving it to your Mac.</small>
          </fieldset>
          <footer>
            <span>{mediaProgress || (status.authenticated ? "Uses your connected Codex allowance" : "Connect ChatGPT before generating")}</span>
            <button type="button" className="chatgpt-primary" onClick={() => void generate()} disabled={!status.authenticated || busy !== null || !request.trim()}>
              {busy === "generate" ? <LoaderCircle className="spin" size={13} /> : <Sparkles size={13} />}
              {busy === "generate" ? "Creating…" : "Create with Codex"}
            </button>
          </footer>
          {mediaProgress && <div className="codex-media-progress" role="status"><LoaderCircle className="spin" size={15} />{mediaProgress}</div>}
          {media.length > 0 && (
            <section className="codex-media-gallery" aria-label="Generated creative media">
              <header><div><strong>Finished media preview</strong><small>Created automatically from the AI Workspace brief</small></div><span>NOT SAVED TO DISK</span></header>
              <div className="codex-media-grid">
                {media.map((item) => (
                  <article className={`codex-media-card ${item.kind}`} key={item.url}>
                    {item.kind === "image"
                      ? <img src={item.url} alt="Generated SocialFlow advertisement" />
                      : <video src={item.url} aria-label="Generated SocialFlow advertisement video" controls autoPlay muted loop playsInline preload="auto" />}
                    <footer>
                      <span><strong>{item.kind === "image" ? "Advertisement image" : "Vertical advertisement video"}</strong><small>{item.mimeType}</small></span>
                      <div className="codex-media-actions">
                        <button type="button" onClick={() => setViewingMedia(item)} aria-label={`View ${item.kind}`}><Eye size={12} /> View</button>
                        <button type="button" onClick={() => downloadMedia(item)} aria-label={`Download ${item.kind}`}><Download size={12} /> Download</button>
                      </div>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          )}
          {result && <article className="codex-result"><header><strong>Generated in SocialFlow</strong><small>{Math.max(1, Math.round(result.elapsedMs / 1000))}s · {result.model}</small></header><pre>{result.content}</pre><button type="button" onClick={() => void copyResult()}>{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy result"}</button></article>}
        </section>

        <aside className="panel chatgpt-security-card">
          <span>{status.authenticated ? "CONNECTED" : status.loginInProgress ? "SIGN-IN IN PROGRESS" : "CONNECTION STATUS"}</span>
          <h3>{status.provider}</h3>
          <p className={`codex-status-detail ${status.authenticated ? "ready" : ""}`}>{status.detail}</p>
          <ul>
            <li><ShieldCheck size={16} /><span><strong>Official OpenAI authentication</strong><small>The login browser belongs to OpenAI; SocialFlow does not imitate or embed it.</small></span></li>
            <li><KeyRound size={16} /><span><strong>No password or API key</strong><small>The official Codex client owns its session. SocialFlow never reads the account password.</small></span></li>
            <li><Sparkles size={16} /><span><strong>Personal subscription mode</strong><small>Generation uses the connected account’s Codex limits and is intended for this local user.</small></span></li>
          </ul>
          {status.authenticated && <button type="button" className="codex-disconnect" onClick={() => void disconnect()} disabled={busy !== null}>{busy === "disconnect" ? <LoaderCircle className="spin" size={12} /> : <LogOut size={12} />} Disconnect</button>}
        </aside>
      </div>

      <section className="chatgpt-starters">
        <header><div><span>QUICK STARTERS</span><h3>Start common social-media work</h3></div><p>Choose a starter, add your brand or campaign details, then generate.</p></header>
        <div>
          {starterPrompts.map(({ title, description, icon: Icon, prompt }) => (
            <article className="panel" key={title}>
              <i><Icon size={17} /></i>
              <h4>{title}</h4>
              <p>{description}</p>
              <button type="button" onClick={() => setRequest(prompt)}><WandSparkles size={12} /> Use starter</button>
            </article>
          ))}
        </div>
      </section>
      {viewingMedia && (
        <div className="codex-media-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`${viewingMedia.kind} preview`} onClick={() => setViewingMedia(undefined)}>
          <section className={`codex-media-viewer ${viewingMedia.kind}`} onClick={(event) => event.stopPropagation()}>
            <header>
              <span><strong>{viewingMedia.kind === "image" ? "Advertisement image" : "Vertical advertisement video"}</strong><small>Review before downloading or publishing</small></span>
              <button type="button" aria-label="Close media viewer" onClick={() => setViewingMedia(undefined)}><X size={17} /></button>
            </header>
            <div>
              {viewingMedia.kind === "image"
                ? <img src={viewingMedia.url} alt="Full-size generated SocialFlow advertisement" />
                : <video src={viewingMedia.url} aria-label="Full-size generated SocialFlow advertisement video" controls playsInline preload="auto" />}
            </div>
            <footer>
              <span>This preview remains temporary until you download it.</span>
              <button type="button" onClick={() => downloadMedia(viewingMedia)}><Download size={13} /> Download {viewingMedia.kind}</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

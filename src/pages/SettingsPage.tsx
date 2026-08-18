import {
  ArchiveRestore,
  Copy,
  Database,
  HardDrive,
  KeyRound,
  LoaderCircle,
  Play,
  Power,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  buildAutopilotPrompt,
  createBackup,
  listBackups,
  listSettings,
  requestRestore,
  updateSetting,
} from "../services/workspace";
import {
  getBackgroundSchedulerStatus,
  getSecurityStatus,
  setBackgroundSchedulerEnabled,
  type BackgroundSchedulerStatus,
  type SecurityStatus,
} from "../services/system";
import type { BackupRecord, SettingRecord } from "../types/workspace";
const get = (settings: SettingRecord[], key: string, fallback: boolean) =>
  (settings.find((s) => s.key === key)?.value as boolean) ?? fallback;
export function SettingsPage() {
  const [settings, setSettings] = useState<SettingRecord[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [background, setBackground] = useState<BackgroundSchedulerStatus>();
  const [security, setSecurity] = useState<SecurityStatus>();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [client, setClient] = useState("");
  const [goal, setGoal] = useState("");
  const [platforms, setPlatforms] = useState("Instagram + Facebook");
  const [frequency, setFrequency] = useState("4 posts/week");
  const [prompt, setPrompt] = useState("");
  const refresh = async () => {
    try {
      const [s, b, schedulerStatus, securityStatus] = await Promise.all([
        listSettings(),
        listBackups(),
        getBackgroundSchedulerStatus(),
        getSecurityStatus(),
      ]);
      setSettings(s);
      setBackups(b);
      setBackground(schedulerStatus);
      setSecurity(securityStatus);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const toggle = async (key: string, value: boolean) => {
    try {
      await updateSetting(key, value);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };
  const backup = async (kind: "database" | "media" | "full") => {
    try {
      const record = await createBackup(kind);
      setNotice(`Backup created: ${record.path}`);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };
  const toggleBackground = async () => {
    if (!background?.supported) return;
    setError("");
    try {
      setNotice("Updating the macOS background scheduler…");
      const status = await setBackgroundSchedulerEnabled(!background.loaded);
      setBackground(status);
      setNotice(status.detail);
    } catch (e) {
      setError(String(e));
    }
  };
  const restore = async (path: string) => {
    if (
      !confirm(
        "Validate this backup and restore it on the next app restart? A safety copy of the current database will be kept.",
      )
    )
      return;
    try {
      setNotice(await requestRestore(path));
    } catch (e) {
      setError(String(e));
    }
  };
  if (loading)
    return (
      <div className="queue-empty">
        <LoaderCircle className="spin" /> Loading settings…
      </div>
    );
  return (
    <div className="settings-page">
      <section className="settings-hero">
        <div>
          <span>PHASES 27–30 · LOCAL CONTROL</span>
          <h2>Settings & Backup</h2>
          <p>
            Safe defaults, local recovery and optional controlled Autopilot.
          </p>
        </div>
        <ShieldCheck size={23} />
      </section>
      {error && (
        <div className="studio-alert error">
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="studio-alert success">
          <span>{notice}</span>
        </div>
      )}
      <div className="settings-grid">
        <section className="panel">
          <header>
            <Database size={16} />
            <div>
              <h3>Scheduler & Publishing</h3>
              <p>Local worker and testing mode</p>
            </div>
          </header>
          <SettingToggle
            label="Local scheduler"
            description="Check due approved posts every 15 seconds"
            value={get(settings, "scheduler.enabled", true)}
            onChange={(v) => void toggle("scheduler.enabled", v)}
          />
          <div className="background-scheduler-control">
            <Power size={15} />
            <span>
              <strong>Run when app is closed</strong>
              <small>
                {background?.detail ?? "Checking macOS LaunchAgent…"}
              </small>
            </span>
            <button
              className={background?.loaded ? "on" : ""}
              disabled={!background?.supported}
              onClick={() => void toggleBackground()}
            >
              {background?.loaded ? "Enabled" : "Enable"}
            </button>
          </div>
          <SettingToggle
            label="Mock Publishing Mode"
            description="Use fake platform IDs and local analytics"
            value={get(settings, "publishing.mock_mode", true)}
            onChange={(v) => void toggle("publishing.mock_mode", v)}
          />
          <SettingToggle
            label="Local notifications"
            description="Show publishing events on this Mac"
            value={get(settings, "notifications.enabled", true)}
            onChange={(v) => void toggle("notifications.enabled", v)}
          />
        </section>
        <section className="panel">
          <header>
            <ShieldCheck size={16} />
            <div>
              <h3>Privacy & Security</h3>
              <p>Permanent product boundaries</p>
            </div>
          </header>
          <div className="security-rule">
            <strong>AI API access</strong>
            <b>Always Off</b>
            <p>
              ChatGPT is used through structured copy/import workflows. No AI
              secret is stored.
            </p>
          </div>
          <div className="security-rule keychain-rule">
            <KeyRound size={14} />
            <strong>OAuth token storage</strong>
            <b>
              {security?.keychainAvailable
                ? "Keychain Ready"
                : (security?.provider ?? "Checking")}
            </b>
            <p>{security?.detail}</p>
          </div>
          <div className="security-rule">
            <strong>Social passwords</strong>
            <b>Never Stored</b>
            <p>
              Official OAuth access tokens, refresh tokens and client secrets
              use macOS Keychain—not source code or SQLite. Social passwords
              are never requested.
            </p>
          </div>
        </section>
        <section className="panel backup-card">
          <header>
            <HardDrive size={16} />
            <div>
              <h3>Local Backups</h3>
              <p>Database, media or complete workspace</p>
            </div>
          </header>
          <div className="backup-actions">
            <button onClick={() => void backup("database")}>
              <Database size={12} /> Database
            </button>
            <button onClick={() => void backup("media")}>
              <Save size={12} /> Media
            </button>
            <button onClick={() => void backup("full")}>
              <HardDrive size={12} /> Full Backup
            </button>
          </div>
          <div className="backup-list">
            {backups.map((b) => (
              <article key={b.path}>
                <span>
                  <strong>{b.name}</strong>
                  <small>
                    {new Date(b.createdAt).toLocaleString()} ·{" "}
                    {b.hasDatabase ? "DB " : ""}
                    {b.hasMedia ? "Media" : ""}
                  </small>
                </span>
                {b.hasDatabase && (
                  <button onClick={() => void restore(b.path)}>
                    <ArchiveRestore size={11} /> Restore
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
        <section className="panel autopilot-card">
          <header>
            <Sparkles size={16} />
            <div>
              <h3>Social Media Autopilot</h3>
              <p>Optional and Off by default</p>
            </div>
            <button
              className={
                get(settings, "approval.autopilot_enabled", false) ? "on" : ""
              }
              onClick={() =>
                void toggle(
                  "approval.autopilot_enabled",
                  !get(settings, "approval.autopilot_enabled", false),
                )
              }
            >
              {get(settings, "approval.autopilot_enabled", false)
                ? "Enabled"
                : "Off"}
            </button>
          </header>
          <div>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Client name"
            />
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Goal"
            />
            <input
              value={platforms}
              onChange={(e) => setPlatforms(e.target.value)}
              placeholder="Platforms"
            />
            <input
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="Frequency"
            />
            <button
              onClick={() =>
                setPrompt(
                  buildAutopilotPrompt(client, goal, platforms, frequency),
                )
              }
            >
              <Play size={12} /> Prepare ChatGPT Step
            </button>
          </div>
          {prompt && <pre>{prompt}</pre>}
          {prompt && (
            <button
              className="copy-auto"
              onClick={() => void navigator.clipboard.writeText(prompt)}
            >
              <Copy size={12} /> Copy Prompt
            </button>
          )}
          <p>
            Autopilot automates everything around ChatGPT; it never silently
            calls this conversation. Human approval remains enabled by default.
          </p>
        </section>
      </div>
    </div>
  );
}
function SettingToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="setting-toggle">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <button className={value ? "on" : ""} onClick={() => onChange(!value)}>
        <i />
      </button>
    </div>
  );
}

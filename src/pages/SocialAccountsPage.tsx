import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  KeyRound,
  Link2,
  LoaderCircle,
  Shield,
  Unplug,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  connectMockAccount,
  connectOfficialAccount,
  disconnectAccount,
  listSocialAccounts,
  setMockFailure,
  validateSocialAccount,
} from "../services/automation";
import { listClients, platformLabels } from "../services/clients";
import type { SocialAccountRecord } from "../types/automation";
import type { ClientSummary, PlatformKey } from "../types/client";
const platforms = Object.keys(platformLabels) as PlatformKey[];
const officialSetup: Record<
  PlatformKey,
  { requirements: string[]; scopes: string; docs: string }
> = {
  instagram: {
    requirements: [
      "Meta developer Business app",
      "Instagram professional account",
      "Linked Facebook Page",
      "Meta App Review for production users",
    ],
    scopes:
      "instagram_basic, instagram_content_publish, instagram_manage_insights, pages_show_list and pages_read_engagement for the Facebook Login flow used by this connector",
    docs: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
  },
  facebook: {
    requirements: [
      "Meta developer Business app",
      "Facebook Page managed by the authorizing user",
      "App Review for production users",
    ],
    scopes: "pages_show_list, pages_read_engagement and pages_manage_posts",
    docs: "https://developers.facebook.com/docs/pages-api/posts",
  },
  linkedin: {
    requirements: [
      "LinkedIn developer app",
      "Verified company Page for organisation posts",
      "Community Management API product approval where required",
    ],
    scopes:
      "openid, profile, w_member_social and/or w_organization_social according to the account owner",
    docs: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api",
  },
  youtube: {
    requirements: [
      "Google Cloud project",
      "OAuth desktop client",
      "YouTube Data API v3 and YouTube Analytics API enabled",
      "OAuth consent-screen verification when required",
    ],
    scopes: "youtube.upload and yt-analytics.readonly",
    docs: "https://developers.google.com/youtube/v3/guides/uploading_a_video",
  },
};
export function SocialAccountsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [accounts, setAccounts] = useState<SocialAccountRecord[]>([]);
  const [client, setClient] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupPlatform, setSetupPlatform] = useState<PlatformKey>();
  const [officialName, setOfficialName] = useState("");
  const [officialId, setOfficialId] = useState("");
  const [officialToken, setOfficialToken] = useState("");
  const [officialExpiry, setOfficialExpiry] = useState("");
  const [officialRefreshToken, setOfficialRefreshToken] = useState("");
  const [officialClientId, setOfficialClientId] = useState("");
  const [officialClientSecret, setOfficialClientSecret] = useState("");
  const [showRefreshFields, setShowRefreshFields] = useState(false);
  const [connectingOfficial, setConnectingOfficial] = useState(false);
  const refresh = async () => {
    setLoading(true);
    try {
      setAccounts(await listSocialAccounts(client || undefined));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    listClients({ filter: "active", sort: "name" }).then(setClients);
  }, []);
  useEffect(() => {
    void refresh();
  }, [client]);
  const connect = async (platform: PlatformKey) => {
    const selected = clients.find((c) => c.id === client);
    if (!selected) return setError("Select a client first.");
    try {
      await connectMockAccount(
        selected.id,
        selected.clientName,
        platform,
        `${selected.brandName} Mock`,
      );
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };
  const action = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };
  const openOfficialSetup = (platform: PlatformKey) => {
    const selected = clients.find((item) => item.id === client);
    if (!selected) {
      setError("Choose a client before setting up an official account.");
      return;
    }
    setSetupPlatform(platform);
    setOfficialName(`${selected?.brandName ?? ""} ${platformLabels[platform]}`.trim());
    setOfficialId("");
    setOfficialToken("");
    setOfficialExpiry("");
    setOfficialRefreshToken("");
    setOfficialClientId("");
    setOfficialClientSecret("");
    setShowRefreshFields(false);
  };
  const connectOfficial = async () => {
    if (!setupPlatform || !client) return setError("Select a client first.");
    setConnectingOfficial(true);
    setError("");
    try {
      await connectOfficialAccount({
        clientId: client,
        platform: setupPlatform,
        accountName: officialName,
        externalAccountId: officialId,
        accessToken: officialToken,
        tokenExpiresAt: officialExpiry ? new Date(officialExpiry).toISOString() : undefined,
        refreshToken: officialRefreshToken || undefined,
        oauthClientId: officialClientId || undefined,
        oauthClientSecret: officialClientSecret || undefined,
        settings: setupPlatform === "linkedin" ? { linkedin_version: "202601" } : setupPlatform === "instagram" || setupPlatform === "facebook" ? { graph_api_version: "v23.0" } : {},
      });
      setOfficialToken("");
      setOfficialRefreshToken("");
      setOfficialClientSecret("");
      setSetupPlatform(undefined);
      await refresh();
    } catch (reason) {
      setOfficialToken("");
      setOfficialRefreshToken("");
      setOfficialClientSecret("");
      setError(String(reason));
    } finally {
      setConnectingOfficial(false);
    }
  };
  return (
    <div className="accounts-page">
      <section className="accounts-hero">
        <div>
          <span>PHASE 10–12 · MODULAR ADAPTERS</span>
          <h2>Social Accounts</h2>
          <p>
            Test safely in Mock Mode. Official authorization remains separate
            from AI.
          </p>
        </div>
        <div>
          <Shield size={18} />
          <span>
            <strong>No passwords stored</strong>
            <small>OAuth tokens use macOS Keychain</small>
          </span>
        </div>
      </section>
      {error && (
        <div className="studio-alert error">
          <AlertTriangle size={13} />
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X size={13} />
          </button>
        </div>
      )}
      <section className="accounts-client panel">
        <label>
          Manage accounts for
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">Choose a client</option>
            {clients.map((c) => (
              <option value={c.id} key={c.id}>
                {c.clientName}
              </option>
            ))}
          </select>
        </label>
        <p>Mock connections publish fake IDs and fake analytics only.</p>
      </section>
      {loading ? (
        <div className="queue-empty">
          <LoaderCircle className="spin" /> Loading accounts…
        </div>
      ) : (
        <section className="account-grid">
          {platforms.map((platform) => {
            const rank: Record<string, number> = { connected: 0, mock: 1, connecting: 2, expired: 3, error: 4, disconnected: 5 };
            const platformAccounts = accounts
              .filter((a) => a.platform === platform && (!client || a.clientId === client))
              .sort((a, b) => (rank[a.connectionStatus] ?? 9) - (rank[b.connectionStatus] ?? 9));
            const account = platformAccounts[0];
            const activeAccount = account && account.connectionStatus !== "disconnected" ? account : undefined;
            return (
              <article className="panel" key={platform}>
                <header>
                  <i className={platform}>{platformLabels[platform][0]}</i>
                  <div>
                    <h3>{platformLabels[platform]}</h3>
                    <p>{account?.clientName ?? clients.find((item) => item.id === client)?.clientName ?? "No client selected"}</p>
                  </div>
                  <b className={activeAccount?.connectionStatus ?? "disconnected"}>
                    {activeAccount?.connectionStatus === "mock"
                      ? "Mock Connected"
                      : (activeAccount?.connectionStatus ?? "Disconnected")}
                  </b>
                </header>
                {activeAccount ? (
                  <>
                    <div className="account-detail">
                      <span>Account</span>
                      <strong>{activeAccount.accountName}</strong>
                      <small>
                        Last verified{" "}
                        {activeAccount.lastValidatedAt
                          ? new Date(activeAccount.lastValidatedAt).toLocaleString()
                          : "never"}
                      </small>
                    </div>
                    {activeAccount.connectionStatus === "mock" && <div className="mock-test">
                      <FlaskConical size={13} />
                      <span>
                        <strong>Failure simulation</strong>
                        <small>Make the next publish fail once</small>
                      </span>
                      <button
                        className={activeAccount.mockFailNext ? "active" : ""}
                        onClick={() =>
                          void action(() =>
                            setMockFailure(activeAccount.id, !activeAccount.mockFailNext),
                          )
                        }
                      >
                        {activeAccount.mockFailNext ? "Armed" : "Off"}
                      </button>
                    </div>}
                    <footer>
                      {activeAccount.connectionStatus === "connected" && <button onClick={() => void action(() => validateSocialAccount(activeAccount.id))}><CheckCircle2 size={12}/> Validate</button>}
                      {activeAccount.connectionStatus === "mock" && <button onClick={() => openOfficialSetup(platform)}><Link2 size={12}/> Connect Official</button>}
                      <button
                        onClick={() =>
                            void action(() => disconnectAccount(activeAccount.id))
                        }
                      >
                        <Unplug size={12} /> Disconnect
                      </button>
                    </footer>
                  </>
                ) : (
                  <div className="account-connect">
                    <p>
                      Connect in Mock Mode to test scheduling, publishing,
                      failure and retry without credentials.
                    </p>
                    <button
                      disabled={!client}
                      onClick={() => void connect(platform)}
                    >
                      <FlaskConical size={12} /> Connect Mock
                    </button>
                    <button disabled={!client} onClick={() => openOfficialSetup(platform)}>
                      <Link2 size={12} /> Set up official access
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
      <section className="official-requirements panel">
        <h3>Official platform requirements</h3>
        <div>
          <span>
            <b>Instagram + Facebook</b> Meta developer app, Facebook Page,
            professional Instagram account and approved permissions.
          </span>
          <span>
            <b>LinkedIn</b> LinkedIn developer app and organisation/member
            publishing authorization.
          </span>
          <span>
            <b>YouTube</b> Google Cloud OAuth client and YouTube Data API
            scopes.
          </span>
        </div>
        <p>
          These are social-platform authorizations—not AI API keys. Real Connect
          publishing activates only after each official developer app is
          registered and authorized.
        </p>
      </section>
      {setupPlatform && (
        <div className="studio-prompt-backdrop" role="dialog" aria-modal="true">
          <section className="official-setup-modal">
            <header>
              <div>
                <span>SOCIAL PLATFORM AUTHORIZATION</span>
                <h3>{platformLabels[setupPlatform]} official access</h3>
              </div>
              <button
                aria-label="Close official setup"
                onClick={() => setSetupPlatform(undefined)}
              >
                <X size={15} />
              </button>
            </header>
            <div>
              <p>
                This is not an AI API key. The social platform must authorize
                SocialFlow OS before real publishing or analytics can run.
              </p>
              <ol>
                {officialSetup[setupPlatform].requirements.map(
                  (requirement) => (
                    <li key={requirement}>{requirement}</li>
                  ),
                )}
              </ol>
              <article>
                <strong>Expected permissions</strong>
                <p>{officialSetup[setupPlatform].scopes}</p>
              </article>
              <article className="keychain-note">
                <Shield size={14} />
                <span>
                  <strong>Secure token storage is ready</strong>
                  <small>
                    OAuth tokens are stored in macOS Keychain, never in SQLite
                    or source code.
                  </small>
                </span>
              </article>
              <section className="official-token-form">
                <h4>Connect an authorized test or production account</h4>
                <p>First create and authorize the official developer application using the platform documentation. Paste the resulting platform access token here only when you are ready; SocialFlow validates it and immediately moves it into macOS Keychain.</p>
                <label>Account display name<input value={officialName} onChange={(event) => setOfficialName(event.target.value)} placeholder="ABC Cafe Instagram"/></label>
                <label>{setupPlatform === "linkedin" ? "Author URN" : setupPlatform === "youtube" ? "YouTube channel ID" : setupPlatform === "instagram" ? "Instagram professional account ID" : "Facebook Page ID"}<input value={officialId} onChange={(event) => setOfficialId(event.target.value)} placeholder={setupPlatform === "linkedin" ? "urn:li:organization:123…" : "Platform account ID"}/></label>
                <label>Platform access token<input type="password" autoComplete="off" value={officialToken} onChange={(event) => setOfficialToken(event.target.value)} placeholder="Stored in Keychain, never SQLite"/></label>
                <label>Token expiry (optional)<input type="datetime-local" value={officialExpiry} onChange={(event) => setOfficialExpiry(event.target.value)}/></label>
                <button type="button" className="official-refresh-toggle" onClick={() => setShowRefreshFields((current) => !current)}><KeyRound size={12}/> {showRefreshFields ? "Hide refresh settings" : "Add refresh settings for unattended scheduling"}</button>
                {showRefreshFields && <div className="official-refresh-fields"><p>Use these only when the platform's OAuth response supplied a refresh token. All values below stay in macOS Keychain.</p><label>Refresh token<input type="password" autoComplete="off" value={officialRefreshToken} onChange={(event) => setOfficialRefreshToken(event.target.value)} placeholder="Optional platform refresh token"/></label><label>OAuth client ID<input autoComplete="off" value={officialClientId} onChange={(event) => setOfficialClientId(event.target.value)} placeholder="Required when using a refresh token"/></label><label>OAuth client secret (if issued)<input type="password" autoComplete="off" value={officialClientSecret} onChange={(event) => setOfficialClientSecret(event.target.value)} placeholder="Optional for native PKCE clients"/></label></div>}
                <button disabled={connectingOfficial || !officialName.trim() || !officialId.trim() || !officialToken.trim()} onClick={() => void connectOfficial()}>{connectingOfficial ? <LoaderCircle className="spin" size={12}/> : <Shield size={12}/>} Validate & Connect Securely</button>
              </section>
            </div>
            <footer>
              <small>Social-platform authorization only. No AI API credential is requested.</small>
              <a
                href={officialSetup[setupPlatform].docs}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={12} /> Open official documentation
              </a>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

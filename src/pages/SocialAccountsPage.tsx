import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FlaskConical,
  KeyRound,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Shield,
  Unplug,
  Wifi,
  X,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
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
  {
    requirements: string[];
    scopes: string;
    docs: string;
    signInUrl: string;
    signInLabel: string;
    ownerLabel: string;
    tokenSetupUrl: string;
    tokenSetupLabel: string;
    tokenHelp: string;
  }
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
    signInUrl: "https://www.facebook.com/login/",
    signInLabel: "Open Meta sign-in",
    ownerLabel: "Facebook account that manages the linked Page",
    tokenSetupUrl: "https://developers.facebook.com/apps/",
    tokenSetupLabel: "Open Meta App Dashboard",
    tokenHelp: "Open or create a Meta Business app, add Instagram, then use its Business Login authorization flow. Meta issues the token after you approve access.",
  },
  facebook: {
    requirements: [
      "Meta developer Business app",
      "Facebook Page managed by the authorizing user",
      "App Review for production users",
    ],
    scopes: "pages_show_list, pages_read_engagement and pages_manage_posts",
    docs: "https://developers.facebook.com/docs/pages-api/posts",
    signInUrl: "https://www.facebook.com/login/",
    signInLabel: "Open Meta sign-in",
    ownerLabel: "Facebook account that manages the Page",
    tokenSetupUrl: "https://developers.facebook.com/apps/",
    tokenSetupLabel: "Open Meta App Dashboard",
    tokenHelp: "Open or create a Meta Business app and configure Facebook Login for Business. Meta issues a Page-capable token after authorization.",
  },
  twitter: {
    requirements: [
      "X developer account, Project and App",
      "OAuth 2.0 Authorization Code flow with PKCE",
      "Write access for the account being connected",
      "An API plan with sufficient posting and media quota",
    ],
    scopes:
      "tweet.read, tweet.write, users.read, media.write and offline.access for refreshable unattended publishing",
    docs: "https://docs.x.com/x-api/posts/manage-tweets/introduction",
    signInUrl: "https://x.com/i/flow/login",
    signInLabel: "Open X sign-in",
    ownerLabel: "X account that will publish the posts",
    tokenSetupUrl: "https://developer.x.com/en/portal/dashboard",
    tokenSetupLabel: "Open X Developer Portal",
    tokenHelp: "Create a Project and App, enable OAuth 2.0 with PKCE and request tweet.write plus offline.access. X returns the user token after authorization.",
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
    signInUrl: "https://accounts.google.com/ServiceLogin?service=youtube",
    signInLabel: "Open Google sign-in",
    ownerLabel: "Google account that manages the YouTube channel",
    tokenSetupUrl: "https://console.cloud.google.com/apis/credentials",
    tokenSetupLabel: "Open Google OAuth Credentials",
    tokenHelp: "Create an OAuth Desktop client after enabling YouTube Data API v3. Google returns an access token and, with offline access, a refresh token after authorization.",
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
  const [showAdvancedConnection, setShowAdvancedConnection] = useState(false);
  const [officialSignInOpened, setOfficialSignInOpened] = useState(false);
  const [openingOfficialSignIn, setOpeningOfficialSignIn] = useState(false);
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
    setShowAdvancedConnection(false);
    setOfficialSignInOpened(false);
  };
  const openOfficialSignIn = async () => {
    if (!setupPlatform) return;
    setOpeningOfficialSignIn(true);
    setError("");
    try {
      await openUrl(officialSetup[setupPlatform].signInUrl);
      setOfficialSignInOpened(true);
    } catch (reason) {
      setError(`Could not open the official sign-in page: ${String(reason)}`);
    } finally {
      setOpeningOfficialSignIn(false);
    }
  };
  const openTokenSetup = async () => {
    if (!setupPlatform) return;
    setError("");
    try {
      await openUrl(officialSetup[setupPlatform].tokenSetupUrl);
    } catch (reason) {
      setError(`Could not open the developer setup page: ${String(reason)}`);
    }
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
        settings: setupPlatform === "instagram" || setupPlatform === "facebook" ? { graph_api_version: "v23.0" } : {},
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
                      {activeAccount.connectionStatus === "mock" && <button className="account-quick-connect" onClick={() => openOfficialSetup(platform)}><Wifi size={12}/> Connect Account</button>}
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
                    <button className="account-quick-connect" disabled={!client} onClick={() => openOfficialSetup(platform)}>
                      <Wifi size={12} /> Connect Account
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
            <b>Twitter</b> X developer Project and App with OAuth 2.0 user
            authorization and write access.
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
                <span>SIMPLE SECURE CONNECTION</span>
                <h3>Connect {platformLabels[setupPlatform]}</h3>
              </div>
              <button
                aria-label="Close official setup"
                onClick={() => setSetupPlatform(undefined)}
              >
                <X size={15} />
              </button>
            </header>
            <div>
              <section className="simple-social-connect">
                <div className="simple-social-connect-icon">
                  <Wifi size={25} />
                </div>
                <div className="simple-social-connect-copy">
                  <h4>Connect it like Wi-Fi</h4>
                  <p>
                    Sign in only on the official {platformLabels[setupPlatform]} page. Your password
                    stays there and is never entered into SocialFlow.
                  </p>
                </div>
                <div className="simple-social-steps">
                  <span><b>1</b> Create developer app</span>
                  <span><b>2</b> Approve account access</span>
                  <span><b>3</b> Connect the issued token</span>
                </div>
                <article className="password-safety-note">
                  <LockKeyhole size={15} />
                  <span>
                    <strong>Your password stays with {platformLabels[setupPlatform]}</strong>
                    <small>Enter it only on the official sign-in page. SocialFlow never sees or stores it.</small>
                  </span>
                </article>
                <button
                  type="button"
                  className="simple-social-connect-button"
                  disabled={openingOfficialSignIn}
                  onClick={() => void openOfficialSignIn()}
                >
                  {openingOfficialSignIn ? <LoaderCircle className="spin" size={14} /> : <Wifi size={14} />}
                  {officialSetup[setupPlatform].signInLabel}
                  {!openingOfficialSignIn && <ArrowRight size={14} />}
                </button>
                {officialSignInOpened && (
                  <div className="official-signin-opened" role="status">
                    <CheckCircle2 size={14} />
                    <span>
                      <strong>Official sign-in opened</strong>
                      <small>Use the {officialSetup[setupPlatform].ownerLabel}. Signing in verifies your account, but the developer authorization below is what creates an access token.</small>
                    </span>
                  </div>
                )}
                <article className="token-location-help">
                  <KeyRound size={15} />
                  <span>
                    <strong>The token is not inside your normal account settings</strong>
                    <small>{officialSetup[setupPlatform].tokenHelp}</small>
                  </span>
                </article>
                <button type="button" className="token-setup-button" onClick={() => void openTokenSetup()}>
                  <ExternalLink size={13} /> {officialSetup[setupPlatform].tokenSetupLabel}
                </button>
              </section>

              <button
                type="button"
                className="advanced-connection-toggle"
                aria-expanded={showAdvancedConnection}
                onClick={() => setShowAdvancedConnection((current) => !current)}
              >
                <span>
                  <strong>Advanced developer connection</strong>
                  <small>For an approved platform app or existing OAuth token</small>
                </span>
                <ChevronDown className={showAdvancedConnection ? "open" : ""} size={15} />
              </button>

              {showAdvancedConnection && <div className="advanced-connection-panel">
                <p>The simple button handles sign-in. Real automatic publishing also requires an approved developer application so the platform can securely return authorization to SocialFlow.</p>
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
                    <small>OAuth tokens are stored in macOS Keychain, never in SQLite or source code.</small>
                  </span>
                </article>
              <section className="official-token-form">
                <h4>Connect an authorized test or production account</h4>
                <p>First create and authorize the official developer application using the platform documentation. Paste the resulting platform access token here only when you are ready; SocialFlow validates it and immediately moves it into macOS Keychain.</p>
                <label>Account display name<input value={officialName} onChange={(event) => setOfficialName(event.target.value)} placeholder={setupPlatform === "twitter" ? "ABC Cafe Twitter" : "ABC Cafe social account"}/></label>
                <label>{setupPlatform === "twitter" ? "Twitter/X user ID" : setupPlatform === "youtube" ? "YouTube channel ID" : setupPlatform === "instagram" ? "Instagram professional account ID" : "Facebook Page ID"}<input value={officialId} onChange={(event) => setOfficialId(event.target.value)} placeholder={setupPlatform === "twitter" ? "Numeric user ID from GET /2/users/me" : "Platform account ID"}/></label>
                <label>Platform access token<input type="password" autoComplete="off" value={officialToken} onChange={(event) => setOfficialToken(event.target.value)} placeholder="Stored in Keychain, never SQLite"/></label>
                <label>Token expiry (optional)<input type="datetime-local" value={officialExpiry} onChange={(event) => setOfficialExpiry(event.target.value)}/></label>
                <button type="button" className="official-refresh-toggle" onClick={() => setShowRefreshFields((current) => !current)}><KeyRound size={12}/> {showRefreshFields ? "Hide refresh settings" : "Add refresh settings for unattended scheduling"}</button>
                {showRefreshFields && <div className="official-refresh-fields"><p>Use these only when the platform's OAuth response supplied a refresh token. All values below stay in macOS Keychain.</p><label>Refresh token<input type="password" autoComplete="off" value={officialRefreshToken} onChange={(event) => setOfficialRefreshToken(event.target.value)} placeholder="Optional platform refresh token"/></label><label>OAuth client ID<input autoComplete="off" value={officialClientId} onChange={(event) => setOfficialClientId(event.target.value)} placeholder="Required when using a refresh token"/></label><label>OAuth client secret (if issued)<input type="password" autoComplete="off" value={officialClientSecret} onChange={(event) => setOfficialClientSecret(event.target.value)} placeholder="Optional for native PKCE clients"/></label></div>}
                <button disabled={connectingOfficial || !officialName.trim() || !officialId.trim() || !officialToken.trim()} onClick={() => void connectOfficial()}>{connectingOfficial ? <LoaderCircle className="spin" size={12}/> : <Shield size={12}/>} Validate & Connect Securely</button>
              </section>
              </div>}
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

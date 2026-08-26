import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  LoaderCircle,
  LockKeyhole,
  Shield,
  Unplug,
  Wifi,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  connectMockAccount,
  connectSocialAccountWithBrowser,
  disconnectAccount,
  listSocialAccounts,
  listSocialOAuthConfigurations,
  setMockFailure,
  validateSocialAccount,
} from "../services/automation";
import { listClients, platformLabels } from "../services/clients";
import type {
  SocialAccountRecord,
  SocialOAuthConfiguration,
} from "../types/automation";
import type { ClientSummary, PlatformKey } from "../types/client";

const platforms = Object.keys(platformLabels) as PlatformKey[];

const officialSetup: Record<PlatformKey, {
  requirements: string[];
  docs: string;
  permissionSummary: string;
}> = {
  instagram: {
    requirements: [
      "Instagram professional account",
      "Linked Facebook Page",
      "Meta Business app approved for publishing",
      "Secure server-side Meta authorization service",
    ],
    docs: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
    permissionSummary: "Publish content and read account insights for the selected professional account.",
  },
  facebook: {
    requirements: [
      "Facebook Page managed by the signing-in user",
      "Meta Business app approved for Page publishing",
      "Secure server-side Meta authorization service",
    ],
    docs: "https://developers.facebook.com/docs/pages-api/posts",
    permissionSummary: "Publish and verify posts for the Page you explicitly select.",
  },
  twitter: {
    requirements: [
      "X developer Project and App",
      "OAuth 2.0 Authorization Code flow with PKCE",
      "Write and media permissions",
      "An API plan with sufficient quota",
    ],
    docs: "https://docs.x.com/x-api/posts/manage-tweets/introduction",
    permissionSummary: "Publish posts and media as the X account you explicitly select.",
  },
  youtube: {
    requirements: [
      "Google Cloud project owned by the app operator",
      "YouTube Data API v3 enabled",
      "OAuth consent screen configured",
      "A Google account with a YouTube channel",
    ],
    docs: "https://developers.google.com/youtube/v3/guides/uploading_a_video",
    permissionSummary: "Upload videos and read channel details for the channel you explicitly select.",
  },
};

export function SocialAccountsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [accounts, setAccounts] = useState<SocialAccountRecord[]>([]);
  const [configurations, setConfigurations] = useState<SocialOAuthConfiguration[]>([]);
  const [client, setClient] = useState("");
  const [setupPlatform, setSetupPlatform] = useState<PlatformKey>();
  const [connectingPlatform, setConnectingPlatform] = useState<PlatformKey>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const configuration = useMemo(
    () => configurations.find((item) => item.platform === setupPlatform),
    [configurations, setupPlatform],
  );

  const refreshAccounts = async (clientId = client) => {
    setAccounts(await listSocialAccounts(clientId || undefined));
  };

  useEffect(() => {
    Promise.all([
      listClients({ filter: "active", sort: "name" }),
      listSocialAccounts(),
      listSocialOAuthConfigurations(),
    ])
      .then(([clientRows, accountRows, configurationRows]) => {
        setClients(clientRows);
        setAccounts(accountRows);
        setConfigurations(configurationRows);
      })
      .catch((reason) => setError(String(reason)))
      .finally(() => setLoading(false));
  }, []);

  const chooseClient = async (clientId: string) => {
    setClient(clientId);
    setError("");
    setNotice("");
    try {
      await refreshAccounts(clientId);
    } catch (reason) {
      setError(String(reason));
    }
  };

  const action = async (work: () => Promise<unknown>) => {
    setError("");
    try {
      await work();
      await refreshAccounts();
    } catch (reason) {
      setError(String(reason));
    }
  };

  const connectMock = async (platform: PlatformKey) => {
    const selected = clients.find((item) => item.id === client);
    if (!selected) return setError("Choose a client first.");
    await action(() =>
      connectMockAccount(
        selected.id,
        selected.clientName,
        platform,
        `${selected.brandName} Mock`,
      ),
    );
  };

  const connectOfficial = async () => {
    if (!setupPlatform || !client) return setError("Choose a client first.");
    if (!configuration?.available) {
      return setError(configuration?.detail ?? "Secure official sign-in is not configured for this platform.");
    }
    setConnectingPlatform(setupPlatform);
    setError("");
    setNotice("");
    try {
      const result = await connectSocialAccountWithBrowser(client, setupPlatform);
      setNotice(`${result.accountName} connected securely. SocialFlow stored the authorization in macOS Keychain.`);
      setSetupPlatform(undefined);
      await refreshAccounts();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setConnectingPlatform(undefined);
    }
  };

  return (
    <div className="accounts-page">
      <section className="accounts-hero">
        <div>
          <span>SECURE SOCIAL CONNECTIONS</span>
          <h2>Social Accounts</h2>
          <p>Connect through each platform's official sign-in. No token copying, passwords or AI keys.</p>
        </div>
        <div>
          <Shield size={18} />
          <span>
            <strong>Keychain protected</strong>
            <small>Minimum permissions · explicit account choice</small>
          </span>
        </div>
      </section>

      {error && (
        <div className="studio-alert error" role="alert">
          <AlertTriangle size={13} />
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")}><X size={13} /></button>
        </div>
      )}
      {notice && (
        <div className="studio-alert success" role="status">
          <CheckCircle2 size={13} />
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={13} /></button>
        </div>
      )}

      <section className="accounts-client panel">
        <label>
          Manage accounts for
          <select value={client} onChange={(event) => void chooseClient(event.target.value)}>
            <option value="">Choose a client</option>
            {clients.map((item) => <option value={item.id} key={item.id}>{item.clientName}</option>)}
          </select>
        </label>
        <p>Mock Mode is always safe. Official publishing stays disabled until a real account is verified.</p>
      </section>

      {loading ? (
        <div className="queue-empty"><LoaderCircle className="spin" /> Loading accounts…</div>
      ) : (
        <section className="account-grid">
          {platforms.map((platform) => {
            const rank: Record<string, number> = { connected: 0, mock: 1, connecting: 2, expired: 3, error: 4, disconnected: 5 };
            const platformAccounts = accounts
              .filter((account) => account.platform === platform && (!client || account.clientId === client))
              .sort((a, b) => (rank[a.connectionStatus] ?? 9) - (rank[b.connectionStatus] ?? 9));
            const account = platformAccounts[0];
            const activeAccount = account?.connectionStatus !== "disconnected" ? account : undefined;
            const platformConfiguration = configurations.find((item) => item.platform === platform);
            return (
              <article className="panel" key={platform}>
                <header>
                  <i className={platform}>{platformLabels[platform][0]}</i>
                  <div>
                    <h3>{platformLabels[platform]}</h3>
                    <p>{account?.clientName ?? clients.find((item) => item.id === client)?.clientName ?? "No client selected"}</p>
                  </div>
                  <b className={activeAccount?.connectionStatus ?? "disconnected"}>
                    {activeAccount?.connectionStatus === "mock" ? "Mock Connected" : (activeAccount?.connectionStatus ?? "Disconnected")}
                  </b>
                </header>
                {activeAccount ? (
                  <>
                    <div className="account-detail">
                      <span>Account</span>
                      <strong>{activeAccount.accountName}</strong>
                      <small>Last verified {activeAccount.lastValidatedAt ? new Date(activeAccount.lastValidatedAt).toLocaleString() : "never"}</small>
                    </div>
                    {activeAccount.connectionStatus === "mock" && (
                      <div className="mock-test">
                        <FlaskConical size={13} />
                        <span><strong>Failure simulation</strong><small>Make the next publish fail once</small></span>
                        <button className={activeAccount.mockFailNext ? "active" : ""} onClick={() => void action(() => setMockFailure(activeAccount.id, !activeAccount.mockFailNext))}>
                          {activeAccount.mockFailNext ? "Armed" : "Off"}
                        </button>
                      </div>
                    )}
                    <footer>
                      {activeAccount.connectionStatus === "connected" && (
                        <button onClick={() => void action(() => validateSocialAccount(activeAccount.id))}><CheckCircle2 size={12} /> Validate</button>
                      )}
                      {activeAccount.connectionStatus === "mock" && (
                        <button className="account-quick-connect" onClick={() => setSetupPlatform(platform)}><Wifi size={12} /> Connect Account</button>
                      )}
                      <button onClick={() => void action(() => disconnectAccount(activeAccount.id))}><Unplug size={12} /> Disconnect</button>
                    </footer>
                  </>
                ) : (
                  <div className="account-connect">
                    <p>{platformConfiguration?.available ? "Official browser sign-in is ready." : "Review the secure setup status before connecting."}</p>
                    <button disabled={!client} onClick={() => void connectMock(platform)}><FlaskConical size={12} /> Connect Mock</button>
                    <button className="account-quick-connect" disabled={!client} onClick={() => setSetupPlatform(platform)}><Wifi size={12} /> Connect Account</button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      <section className="official-requirements panel">
        <h3>How secure connection works</h3>
        <div>
          <span><b>1 · Official sign-in</b> Your password is entered only on the platform's website.</span>
          <span><b>2 · Choose account</b> SocialFlow discovers the channel or account after permission is granted.</span>
          <span><b>3 · Keychain</b> Returned authorization is stored outside the app database.</span>
        </div>
        <p>SocialFlow never asks a normal user to find or paste an access token, refresh token, client secret or numeric account ID.</p>
      </section>

      {setupPlatform && (
        <div className="studio-prompt-backdrop" role="dialog" aria-modal="true" aria-labelledby="social-connect-title">
          <section className="official-setup-modal secure-connect-modal">
            <header>
              <div>
                <span>OFFICIAL AUTHORIZATION</span>
                <h3 id="social-connect-title">Connect {platformLabels[setupPlatform]}</h3>
              </div>
              <button aria-label="Close official setup" onClick={() => setSetupPlatform(undefined)}><X size={15} /></button>
            </header>
            <div>
              <section className="simple-social-connect">
                <div className="simple-social-connect-icon"><Wifi size={25} /></div>
                <div className="simple-social-connect-copy">
                  <h4>Connect it like Wi-Fi</h4>
                  <p>SocialFlow opens the official sign-in page, receives only the permission you approve, discovers the account automatically and stores authorization in macOS Keychain.</p>
                </div>
                <div className="simple-social-steps">
                  <span><b>1</b> Sign in officially</span>
                  <span><b>2</b> Choose account</span>
                  <span><b>3</b> Approve permissions</span>
                </div>
                <article className="password-safety-note">
                  <LockKeyhole size={15} />
                  <span><strong>Your password stays with {platformLabels[setupPlatform]}</strong><small>SocialFlow never sees it. No credential is pasted into this app.</small></span>
                </article>
                <article className={configuration?.available ? "official-signin-opened" : "token-location-help"}>
                  {configuration?.available ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  <span>
                    <strong>{configuration?.available ? "Secure sign-in is ready" : "Owner setup required"}</strong>
                    <small>{configuration?.detail ?? "Secure official sign-in is not configured for this platform."}</small>
                  </span>
                </article>
                <article className="keychain-note">
                  <Shield size={14} />
                  <span><strong>Permission requested</strong><small>{officialSetup[setupPlatform].permissionSummary}</small></span>
                </article>
                <button
                  type="button"
                  className="simple-social-connect-button"
                  disabled={!configuration?.available || connectingPlatform === setupPlatform}
                  onClick={() => void connectOfficial()}
                >
                  {connectingPlatform === setupPlatform ? <LoaderCircle className="spin" size={14} /> : <Wifi size={14} />}
                  {connectingPlatform === setupPlatform ? "Waiting for official sign-in…" : "Open official sign-in"}
                  {connectingPlatform !== setupPlatform && <ArrowRight size={14} />}
                </button>
                <div className="secure-connect-requirements">
                  <strong>Operator prerequisites</strong>
                  <ul>{officialSetup[setupPlatform].requirements.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </section>
            </div>
            <footer>
              <small>Social-platform authorization only. ChatGPT remains separate and unchanged.</small>
              <a href={officialSetup[setupPlatform].docs} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Official documentation</a>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
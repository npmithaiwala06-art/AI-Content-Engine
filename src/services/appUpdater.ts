import { getVersion } from "@tauri-apps/api/app";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { isDesktopRuntime } from "./desktop";

export type AppUpdatePhase =
  | "idle"
  | "checking"
  | "up-to-date"
  | "downloading"
  | "installed"
  | "error"
  | "unsupported";

export interface AppUpdateState {
  phase: AppUpdatePhase;
  currentVersion?: string;
  availableVersion?: string;
  downloadedBytes: number;
  totalBytes?: number;
  lastCheckedAt?: string;
  message: string;
}

const SIX_HOURS = 6 * 60 * 60 * 1_000;
const INITIAL_CHECK_DELAY = 5_000;

let state: AppUpdateState = {
  phase: "idle",
  downloadedBytes: 0,
  message: "Automatic updates are enabled.",
};
let activeCheck: Promise<AppUpdateState> | undefined;
const listeners = new Set<() => void>();

function publish(patch: Partial<AppUpdateState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function getAppUpdateState() {
  return state;
}

export function subscribeToAppUpdates(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function handleDownloadEvent(event: DownloadEvent) {
  if (event.event === "Started") {
    publish({
      phase: "downloading",
      downloadedBytes: 0,
      totalBytes: event.data.contentLength,
      message: "Downloading the latest SocialFlow OS update…",
    });
  } else if (event.event === "Progress") {
    publish({ downloadedBytes: state.downloadedBytes + event.data.chunkLength });
  } else if (event.event === "Finished") {
    publish({ message: "Verifying and installing the update…" });
  }
}

async function runUpdateCheck(): Promise<AppUpdateState> {
  if (!isDesktopRuntime()) {
    publish({
      phase: "unsupported",
      message: "Updates are available in the installed desktop app.",
    });
    return state;
  }

  publish({ phase: "checking", message: "Checking GitHub Releases for updates…" });

  try {
    const currentVersion = await getVersion();
    const update = await check({ timeout: 30_000 });
    const lastCheckedAt = new Date().toISOString();

    if (!update) {
      publish({
        phase: "up-to-date",
        currentVersion,
        availableVersion: undefined,
        lastCheckedAt,
        message: `SocialFlow OS ${currentVersion} is up to date.`,
      });
      return state;
    }

    publish({
      phase: "downloading",
      currentVersion,
      availableVersion: update.version,
      downloadedBytes: 0,
      totalBytes: undefined,
      lastCheckedAt,
      message: `Downloading SocialFlow OS ${update.version}…`,
    });
    await update.downloadAndInstall(handleDownloadEvent);
    publish({
      phase: "installed",
      downloadedBytes: state.totalBytes ?? state.downloadedBytes,
      message: `SocialFlow OS ${update.version} is installed and will open next time you launch the app.`,
    });
  } catch (reason) {
    publish({
      phase: "error",
      lastCheckedAt: new Date().toISOString(),
      message: reason instanceof Error ? reason.message : String(reason),
    });
  }

  return state;
}

export function checkForAppUpdate() {
  if (activeCheck) return activeCheck;
  activeCheck = runUpdateCheck().finally(() => {
    activeCheck = undefined;
  });
  return activeCheck;
}

export function startAutomaticAppUpdates(
  initialDelay = INITIAL_CHECK_DELAY,
  interval = SIX_HOURS,
) {
  if (!isDesktopRuntime()) return () => undefined;

  const initialTimer = window.setTimeout(() => void checkForAppUpdate(), initialDelay);
  const intervalTimer = window.setInterval(() => void checkForAppUpdate(), interval);

  return () => {
    window.clearTimeout(initialTimer);
    window.clearInterval(intervalTimer);
  };
}

export function resetAppUpdaterForTests() {
  activeCheck = undefined;
  state = {
    phase: "idle",
    downloadedBytes: 0,
    message: "Automatic updates are enabled.",
  };
  listeners.clear();
}

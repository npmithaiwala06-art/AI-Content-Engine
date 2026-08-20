import { CheckCircle2, DownloadCloud } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import {
  getAppUpdateState,
  startAutomaticAppUpdates,
  subscribeToAppUpdates,
} from "../services/appUpdater";

export function useAppUpdateState() {
  return useSyncExternalStore(
    subscribeToAppUpdates,
    getAppUpdateState,
    getAppUpdateState,
  );
}

export function AppUpdater() {
  const update = useAppUpdateState();

  useEffect(() => startAutomaticAppUpdates(), []);

  if (update.phase !== "downloading" && update.phase !== "installed") return null;

  const progress = update.totalBytes
    ? Math.min(100, Math.round((update.downloadedBytes / update.totalBytes) * 100))
    : undefined;

  return (
    <aside className={`app-update-toast ${update.phase}`} role="status">
      {update.phase === "installed" ? (
        <CheckCircle2 size={18} />
      ) : (
        <DownloadCloud size={18} />
      )}
      <span>
        <strong>{update.phase === "installed" ? "Update ready" : "Updating SocialFlow OS"}</strong>
        <small>{update.message}</small>
        {update.phase === "downloading" && (
          <i>
            <b style={{ width: `${progress ?? 8}%` }} />
          </i>
        )}
      </span>
      {progress !== undefined && update.phase === "downloading" && <em>{progress}%</em>}
    </aside>
  );
}

import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "./desktop";

export interface SecurityStatus {
  keychainAvailable: boolean;
  provider: string;
  detail: string;
}

export interface BackgroundSchedulerStatus {
  supported: boolean;
  installed: boolean;
  loaded: boolean;
  agentPath: string;
  executablePath: string;
  detail: string;
}

export async function getSecurityStatus(): Promise<SecurityStatus> {
  if (isDesktopRuntime()) return invoke("get_security_status");
  return {
    keychainAvailable: false,
    provider: "Browser preview",
    detail: "macOS Keychain is available in the desktop application.",
  };
}

export async function getBackgroundSchedulerStatus(): Promise<BackgroundSchedulerStatus> {
  if (isDesktopRuntime()) return invoke("get_background_scheduler_status");
  return {
    supported: false,
    installed: false,
    loaded: false,
    agentPath: "",
    executablePath: "",
    detail: "Background scheduling is configured in the desktop application.",
  };
}

export async function setBackgroundSchedulerEnabled(
  enabled: boolean,
): Promise<BackgroundSchedulerStatus> {
  if (!isDesktopRuntime()) {
    throw new Error(
      "Background scheduling is available in the desktop application.",
    );
  }
  return invoke("set_background_scheduler_enabled", { enabled });
}

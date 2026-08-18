import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "./desktop";
import type { ReleaseReadiness } from "../types/readiness";

const preview = (): ReleaseReadiness => ({
  appVersion: "Browser preview",
  generatedAt: new Date().toISOString(),
  completeCount: 0,
  remainingCount: 4,
  allComplete: false,
  phases: [12, 35, 37, 40].map((phase) => ({
    phase,
    title: phase === 12 ? "Official social connections" : phase === 35 ? "Live scheduler and publishing tests" : phase === 37 ? "Production macOS distribution" : "Final product audit",
    status: "needs_external_action",
    summary: "Desktop verification required",
    checks: [{ id: `desktop-${phase}`, label: "Run this check in the macOS app", status: "blocked", detail: "Browser preview cannot access Keychain, code signing, SQLite or real platform tokens." }],
  })),
});

export async function getReleaseReadiness(): Promise<ReleaseReadiness> {
  if (!isDesktopRuntime()) return preview();
  return invoke("get_release_readiness");
}

export async function exportReleaseReadiness(): Promise<string> {
  if (!isDesktopRuntime()) throw new Error("Export the release audit from the macOS desktop app.");
  return invoke("export_release_readiness");
}

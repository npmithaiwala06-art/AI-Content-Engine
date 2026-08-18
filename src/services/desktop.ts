import { invoke } from "@tauri-apps/api/core";
import { demoSummary } from "../data/demoData";
import type { DashboardSummary } from "../types/dashboard";

export const isDesktopRuntime = () => "__TAURI_INTERNALS__" in window;

export async function initialiseApplication(): Promise<string> {
  if (!isDesktopRuntime()) return "Browser preview mode";
  return invoke<string>("initialize_application");
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  if (!isDesktopRuntime()) return demoSummary;
  return invoke<DashboardSummary>("get_dashboard_summary");
}

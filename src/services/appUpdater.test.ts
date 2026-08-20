import { beforeEach, describe, expect, it, vi } from "vitest";
import { check } from "@tauri-apps/plugin-updater";
import { getVersion } from "@tauri-apps/api/app";
import {
  checkForAppUpdate,
  getAppUpdateState,
  resetAppUpdaterForTests,
} from "./appUpdater";

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));

describe("app updater", () => {
  beforeEach(() => {
    resetAppUpdaterForTests();
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    vi.mocked(getVersion).mockResolvedValue("0.3.4");
  });

  it("reports when the installed app is current", async () => {
    vi.mocked(check).mockResolvedValue(null);
    await checkForAppUpdate();
    expect(getAppUpdateState()).toMatchObject({ phase: "up-to-date", currentVersion: "0.3.4" });
  });

  it("downloads and installs an available signed update", async () => {
    const downloadAndInstall = vi.fn(async (onEvent) => {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 100 } });
      onEvent({ event: "Finished" });
    });
    vi.mocked(check).mockResolvedValue({ version: "0.3.5", downloadAndInstall } as never);
    await checkForAppUpdate();
    expect(downloadAndInstall).toHaveBeenCalledOnce();
    expect(getAppUpdateState()).toMatchObject({
      phase: "installed",
      availableVersion: "0.3.5",
      downloadedBytes: 100,
    });
  });
});

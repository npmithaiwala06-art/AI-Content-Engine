import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import {
  connectSocialAccountWithBrowser,
  listSocialOAuthConfigurations,
} from "./automation";
import * as automationService from "./automation";

beforeEach(() => {
  invoke.mockReset();
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {},
    configurable: true,
  });
});

describe("secure social OAuth service", () => {
  it("does not expose the legacy manual-token command", () => {
    expect(automationService).not.toHaveProperty("connectOfficialAccount");
  });

  it("loads backend-owned connection availability without requesting credentials", async () => {
    invoke.mockResolvedValueOnce([]);

    await listSocialOAuthConfigurations();

    expect(invoke).toHaveBeenCalledWith("list_social_oauth_configurations");
  });

  it("starts browser authorization with only client and platform identifiers", async () => {
    invoke.mockResolvedValueOnce({
      accountId: "account-1",
      platform: "youtube",
      accountName: "ZeroOne",
      externalAccountId: "channel-1",
    });

    await connectSocialAccountWithBrowser("client-1", "youtube");

    expect(invoke).toHaveBeenCalledWith("connect_social_account_with_browser", {
      input: { clientId: "client-1", platform: "youtube" },
    });
  });
});

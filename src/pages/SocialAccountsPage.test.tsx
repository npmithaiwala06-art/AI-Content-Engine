import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SocialAccountsPage } from "./SocialAccountsPage";

const automation = vi.hoisted(() => ({
  listSocialAccounts: vi.fn(),
  listSocialOAuthConfigurations: vi.fn(),
  connectSocialAccountWithBrowser: vi.fn(),
  connectMockAccount: vi.fn(),
  disconnectAccount: vi.fn(),
  setMockFailure: vi.fn(),
  validateSocialAccount: vi.fn(),
}));

vi.mock("../services/automation", () => automation);
vi.mock("../services/clients", () => ({
  platformLabels: {
    instagram: "Instagram",
    facebook: "Facebook",
    twitter: "X",
    youtube: "YouTube",
  },
  listClients: vi.fn().mockResolvedValue([
    {
      id: "client-1",
      clientName: "ZeroOne",
      brandName: "ZeroOne AI Lab",
    },
  ]),
}));

beforeEach(() => {
  Object.values(automation).forEach((mock) => mock.mockReset());
  automation.listSocialAccounts.mockResolvedValue([]);
  automation.listSocialOAuthConfigurations.mockResolvedValue([
    {
      platform: "youtube",
      available: true,
      connectionMethod: "browser_pkce",
      detail: "Ready for secure official sign-in.",
    },
  ]);
});
afterEach(cleanup);

describe("Social Accounts secure connection", () => {
  it("never asks a normal user to paste OAuth credentials", async () => {
    render(<SocialAccountsPage />);
    fireEvent.change(await screen.findByLabelText(/Manage accounts for/i), {
      target: { value: "client-1" },
    });
    const buttons = await screen.findAllByRole("button", { name: /Connect Account/i });
    fireEvent.click(buttons[3]);

    await screen.findByRole("heading", { name: /Connect YouTube/i });
    expect(screen.queryByRole("button", { name: /Advanced developer connection/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/access token/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/client secret/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/refresh token/i)).not.toBeInTheDocument();
  });

  it("passes only the chosen client and platform to secure browser authorization", async () => {
    automation.connectSocialAccountWithBrowser.mockResolvedValue({
      accountId: "account-1",
      platform: "youtube",
      accountName: "ZeroOne",
      externalAccountId: "channel-1",
    });
    render(<SocialAccountsPage />);
    fireEvent.change(await screen.findByLabelText(/Manage accounts for/i), {
      target: { value: "client-1" },
    });
    const buttons = await screen.findAllByRole("button", { name: /Connect Account/i });
    fireEvent.click(buttons[3]);
    fireEvent.click(await screen.findByRole("button", { name: /Open official sign-in/i }));

    await waitFor(() =>
      expect(automation.connectSocialAccountWithBrowser).toHaveBeenCalledWith(
        "client-1",
        "youtube",
      ),
    );
  });
});

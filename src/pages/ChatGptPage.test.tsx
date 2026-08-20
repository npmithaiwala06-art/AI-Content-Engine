import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatGptPage } from "./ChatGptPage";

const { connectCodex, disconnectCodex, generateWithCodex, getCodexStatus, takeStagedCodexCreativeRequest } = vi.hoisted(() => ({
  connectCodex: vi.fn(() => Promise.resolve()),
  disconnectCodex: vi.fn(() => Promise.resolve()),
  generateWithCodex: vi.fn((_prompt: string) => Promise.resolve({
    provider: "codex_chatgpt_subscription" as const,
    model: "Codex subscription model",
    content: "Generated social content",
    elapsedMs: 1200,
  })),
  getCodexStatus: vi.fn(() => Promise.resolve({
    installed: true,
    authenticated: true,
    loginInProgress: false,
    provider: "Official Codex client",
    detail: "Connected with your ChatGPT account through the official Codex client.",
  })),
  takeStagedCodexCreativeRequest: vi.fn((): unknown => undefined),
}));

vi.mock("../services/chatgpt", () => ({
  connectCodex,
  disconnectCodex,
  generateWithCodex,
  getCodexStatus,
  takeStagedCodexCreativeRequest,
}));

describe("ChatGPT subscription connection", () => {
  beforeEach(() => {
    connectCodex.mockClear();
    disconnectCodex.mockClear();
    generateWithCodex.mockClear();
    getCodexStatus.mockClear();
    takeStagedCodexCreativeRequest.mockReset();
    takeStagedCodexCreativeRequest.mockReturnValue(undefined);
  });

  afterEach(() => cleanup());

  it("shows the official Codex connection without exposing credentials", async () => {
    render(<ChatGptPage />);

    expect(await screen.findByRole("button", { name: "Connected" })).toBeInTheDocument();
    expect(screen.getByText("No password or API key")).toBeInTheDocument();
    expect(screen.getByText("Official OpenAI authentication")).toBeInTheDocument();
  });

  it("starts generation inside SocialFlow through Codex", async () => {
    render(<ChatGptPage />);
    await screen.findByRole("button", { name: "Connected" });

    fireEvent.change(screen.getByPlaceholderText(/Write a 30-second Instagram reel/), {
      target: { value: "Write a launch caption for ABC Cafe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create with Codex" }));

    await waitFor(() => expect(generateWithCodex).toHaveBeenCalledOnce());
    expect(generateWithCodex.mock.calls[0][0]).toContain("Write a launch caption for ABC Cafe");
    expect(generateWithCodex.mock.calls[0][0]).toContain("IMAGE DELIVERABLE");
    expect(await screen.findByText("Generated social content")).toBeInTheDocument();
  });

  it("loads a staged Brand Memory brief and creates both ad formats", async () => {
    takeStagedCodexCreativeRequest.mockReturnValueOnce({
      prompt: "CLIENT AND BRAND MEMORY\nBrand: ABC Cafe\nGoal: Increase visits",
      clientName: "ABC Cafe",
      goal: "Increase visits",
      topic: "Weekend brunch",
      suggestedMode: "both",
    });
    render(<ChatGptPage />);
    await screen.findByRole("button", { name: "Connected" });

    expect((screen.getByRole("textbox", { name: "What should SocialFlow create?" }) as HTMLTextAreaElement).value).toContain("Brand: ABC Cafe");
    expect(screen.getByRole("button", { name: /Image \+ video/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Create with Codex" }));

    await waitFor(() => expect(generateWithCodex).toHaveBeenCalledOnce());
    expect(generateWithCodex.mock.calls[0][0]).toContain("IMAGE DELIVERABLE");
    expect(generateWithCodex.mock.calls[0][0]).toContain("VIDEO DELIVERABLE");
  });

  it("starts official browser authentication when disconnected", async () => {
    getCodexStatus.mockResolvedValueOnce({
      installed: true,
      authenticated: false,
      loginInProgress: false,
      provider: "Official Codex client",
      detail: "Codex is installed but no ChatGPT account is connected yet.",
    });
    render(<ChatGptPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect ChatGPT" }));
    await waitFor(() => expect(connectCodex).toHaveBeenCalledOnce());
    expect(await screen.findByRole("status")).toHaveTextContent("Official OpenAI sign-in started");
  });
});

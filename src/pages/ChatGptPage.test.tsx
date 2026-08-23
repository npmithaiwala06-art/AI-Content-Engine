import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatGptPage } from "./ChatGptPage";

const { connectCodex, disconnectCodex, generateWithCodex, getCodexStatus, takeStagedCodexCreativeRequest, parseCreativePackage, renderCreativeMedia, releaseGeneratedMedia } = vi.hoisted(() => ({
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
  parseCreativePackage: vi.fn(() => ({
    campaignName: "Launch",
    brandName: "ABC Cafe",
    headline: "Make your weekend count",
    subheadline: "A better coffee break is waiting.",
    cta: "Visit today",
    palette: ["#160A3A", "#6D4AFF", "#18A98C", "#FFFFFF"],
  })),
  renderCreativeMedia: vi.fn((_creative: unknown, mode: "image" | "video" | "both") => Promise.resolve([
    ...(mode !== "video" ? [{ kind: "image" as const, url: "blob:image", fileName: "launch.png", mimeType: "image/png", blob: new Blob() }] : []),
    ...(mode !== "image" ? [{ kind: "video" as const, url: "blob:video", fileName: "launch.webm", mimeType: "video/webm", blob: new Blob() }] : []),
  ])),
  releaseGeneratedMedia: vi.fn(),
}));

vi.mock("../services/chatgpt", () => ({
  connectCodex,
  disconnectCodex,
  generateWithCodex,
  getCodexStatus,
  takeStagedCodexCreativeRequest,
}));

vi.mock("../services/localCreativeRenderer", () => ({
  parseCreativePackage,
  renderCreativeMedia,
  releaseGeneratedMedia,
}));

describe("ChatGPT subscription connection", () => {
  beforeEach(() => {
    connectCodex.mockClear();
    disconnectCodex.mockClear();
    generateWithCodex.mockClear();
    getCodexStatus.mockClear();
    takeStagedCodexCreativeRequest.mockReset();
    takeStagedCodexCreativeRequest.mockReturnValue(undefined);
    parseCreativePackage.mockClear();
    renderCreativeMedia.mockClear();
    releaseGeneratedMedia.mockClear();
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
    expect(generateWithCodex.mock.calls[0][0]).toContain("CREATE TYPE: IMAGE");
    expect(renderCreativeMedia).toHaveBeenCalledWith(expect.anything(), "image", expect.any(Function));
    expect(await screen.findByRole("img", { name: "Generated SocialFlow advertisement" })).toBeInTheDocument();
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
    expect(generateWithCodex.mock.calls[0][0]).toContain("CREATE TYPE: IMAGE AND VIDEO");
    expect(renderCreativeMedia).toHaveBeenCalledWith(expect.anything(), "both", expect.any(Function));
    expect(await screen.findByRole("img", { name: "Generated SocialFlow advertisement" })).toBeInTheDocument();
    expect(screen.getByLabelText("Generated SocialFlow advertisement video")).toBeInTheDocument();
  });

  it("creates a playable video when video is selected", async () => {
    render(<ChatGptPage />);
    await screen.findByRole("button", { name: "Connected" });

    fireEvent.change(screen.getByPlaceholderText(/Write a 30-second Instagram reel/), { target: { value: "Advertise SocialFlow OS" } });
    fireEvent.click(screen.getByRole("button", { name: /Create video/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create with Codex" }));

    await waitFor(() => expect(renderCreativeMedia).toHaveBeenCalledWith(expect.anything(), "video", expect.any(Function)));
    const video = await screen.findByLabelText("Generated SocialFlow advertisement video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(screen.getByRole("button", { name: "View video" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download video" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View video" }));
    expect(screen.getByRole("dialog", { name: "video preview" })).toBeInTheDocument();
    expect(screen.getByLabelText("Full-size generated SocialFlow advertisement video")).toHaveAttribute("controls");
    expect(screen.getByRole("button", { name: "Close media viewer" })).toBeInTheDocument();
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

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

describe("Phase 3 AI Workspace", () => {
  const writeText = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    localStorage.clear();
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });
  afterEach(() => cleanup());

  it("validates that a client is selected before generating", async () => {
    render(<MemoryRouter initialEntries={["/ai-workspace"]}><App /></MemoryRouter>);
    await screen.findByRole("button", { name: "Generate ChatGPT Prompt" });
    fireEvent.click(screen.getByRole("button", { name: "Generate ChatGPT Prompt" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Select a client");
  });

  it("generates, stores and copies a Brand Profile-aware prompt", async () => {
    render(<MemoryRouter initialEntries={["/ai-workspace"]}><App /></MemoryRouter>);
    const clientSelect = await screen.findByRole("combobox", { name: "AI Workspace client" });
    fireEvent.change(clientSelect, { target: { value: "preview-abc-cafe" } });
    await screen.findByText(/Cafe & Restaurant · Friendly, energetic and local/);

    fireEvent.change(screen.getByRole("textbox", { name: "Content goal" }), { target: { value: "Increase weekend customers" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Content topic" }), { target: { value: "Weekend coffee offer" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate ChatGPT Prompt" }));

    const preview = await screen.findByLabelText("Generated ChatGPT prompt");
    expect(preview).toHaveTextContent("Brand voice: Friendly, energetic and local");
    expect(preview).toHaveTextContent("Instagram requirements:");
    expect(preview).toHaveTextContent("Facebook requirements:");
    expect(preview).toHaveTextContent('"format_version": "social_content_v1"');
    expect(screen.getByRole("status")).toHaveTextContent("Prompt generated and saved locally");

    fireEvent.click(screen.getByRole("button", { name: "Copy Prompt" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(await screen.findByRole("status")).toHaveTextContent("paste it into ChatGPT");
    expect(screen.getByText("1 copy")).toBeInTheDocument();
  });

  it("applies the selected planning template", async () => {
    render(<MemoryRouter initialEntries={["/ai-workspace"]}><App /></MemoryRouter>);
    await screen.findByRole("button", { name: /Single post/ });
    fireEvent.click(screen.getByRole("button", { name: /Single post/ }));
    expect(screen.getByRole("spinbutton", { name: "Number of posts" })).toHaveValue(1);
    fireEvent.click(screen.getByRole("button", { name: /30-day plan/ }));
    expect(screen.getByRole("spinbutton", { name: "Number of posts" })).toHaveValue(30);
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    await screen.findByRole("button", { name: "Generate Content" });
    fireEvent.click(screen.getByRole("button", { name: "Generate Content" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Select a client");
  });

  it("transfers a Brand Profile-aware prompt to the SocialFlow content assistant", async () => {
    render(<MemoryRouter initialEntries={["/ai-workspace"]}><App /></MemoryRouter>);
    const clientSelect = await screen.findByRole("combobox", { name: "AI Workspace client" });
    fireEvent.change(clientSelect, { target: { value: "preview-abc-cafe" } });
    await screen.findByText(/Cafe & Restaurant · Friendly, energetic and local/);

    fireEvent.change(screen.getByRole("textbox", { name: "Content goal" }), { target: { value: "Increase weekend customers" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Content topic" }), { target: { value: "Weekend coffee offer" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate Content" }));

    const transferred = await screen.findByRole("textbox", { name: "What should SocialFlow create?" });
    const transferredValue = (transferred as HTMLTextAreaElement).value;
    expect(transferredValue).toContain("Brand voice: Friendly, energetic and local");
    expect(transferredValue).toContain("Instagram requirements:");
    expect(transferredValue).toContain("Facebook requirements:");
    expect(screen.getByRole("button", { name: /Image \+ video/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("applies the selected planning template", async () => {
    render(<MemoryRouter initialEntries={["/ai-workspace"]}><App /></MemoryRouter>);
    await screen.findByRole("button", { name: /Single post/ });
    fireEvent.click(screen.getByRole("button", { name: /Single post/ }));
    expect(screen.getByRole("spinbutton", { name: "Number of posts" })).toHaveValue(1);
    fireEvent.click(screen.getByRole("button", { name: /30-day plan/ }));
    expect(screen.getByRole("spinbutton", { name: "Number of posts" })).toHaveValue(30);
  });

  it("offers the three automation modes without replacing the existing ChatGPT workflow", async () => {
    render(<MemoryRouter initialEntries={["/ai-workspace"]}><App /></MemoryRouter>);
    await screen.findByRole("button", { name: "Generate Content" });
    expect(screen.getByRole("combobox", { name: "Automation mode" })).toHaveValue("manual_approval");
    expect(screen.getByRole("option", { name: "Manual Approval" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Auto Schedule" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Full Autopilot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Automation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Content" })).toBeInTheDocument();
  });
});

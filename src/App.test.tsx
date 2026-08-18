import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";

describe("Phase 1 application shell", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("renders the dashboard and core product law", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText("Create once. Adapt everywhere.")).toBeInTheDocument();
    expect(screen.getByText("AI Workspace")).toBeInTheDocument();
    expect(await screen.findByText("Platform performance")).toBeInTheDocument();
  });

  it("navigates from the dashboard create-content action", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: "Create new content" }));
    expect(await screen.findByText("Turn one idea into native content for every platform.")).toBeInTheDocument();
  });

  it("opens application search with Command-K", () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog", { name: "Application search" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search pages and actions" })).toHaveFocus();
  });

  it("opens notifications and collapses the sidebar", () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("dialog", { name: "Notifications panel" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});

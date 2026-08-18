import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../App";

describe("Phase 4 ChatGPT content importer", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("parses, previews, edits and saves selected platform content as Drafts", async () => {
    render(<MemoryRouter initialEntries={["/ai-workspace/import"]}><App /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Load safe example" }));
    fireEvent.click(screen.getByRole("button", { name: "Parse and Preview" }));
    expect(await screen.findByText("1 post parsed successfully")).toBeInTheDocument();
    expect(screen.getByText(/3 platform versions/)).toBeInTheDocument();
    expect(screen.getByText("Will save as Draft")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Title for post 1" }), { target: { value: "Edited Weekend Offer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Selected Drafts" }));
    expect(await screen.findByRole("heading", { name: "1 draft saved locally" })).toBeInTheDocument();
    expect(screen.getByText(/must pass human approval/)).toBeInTheDocument();
  });

  it("detects a repeated import and prevents duplicate saving", async () => {
    render(<MemoryRouter initialEntries={["/ai-workspace/import"]}><App /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Load safe example" }));
    fireEvent.click(screen.getByRole("button", { name: "Parse and Preview" }));
    await screen.findByText("1 post parsed successfully");
    fireEvent.click(screen.getByRole("button", { name: "Save Selected Drafts" }));
    await screen.findByRole("heading", { name: "1 draft saved locally" });
    fireEvent.click(screen.getByRole("button", { name: "Import Another Result" }));
    fireEvent.click(screen.getByRole("button", { name: "Load safe example" }));
    fireEvent.click(screen.getByRole("button", { name: "Parse and Preview" }));
    expect(await screen.findByText("Already imported")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save Selected Drafts" })).toBeDisabled());
  });
});

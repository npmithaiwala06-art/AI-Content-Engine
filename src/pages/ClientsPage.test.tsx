import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../App";

describe("Phase 2 client and brand management", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("searches and filters the multi-client directory", async () => {
    render(<MemoryRouter initialEntries={["/clients"]}><App /></MemoryRouter>);
    expect(await screen.findByText("Northstar Studio")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search clients" }), { target: { value: "Northstar" } });
    await waitFor(() => expect(screen.queryByText("ABC Cafe")).not.toBeInTheDocument());
    expect(screen.getByText("Northstar Studio")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search clients" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter clients" }), { target: { value: "paused" } });
    expect(await screen.findByText("Mira Wellness")).toBeInTheDocument();
  });

  it("creates a client with persistent brand memory and platforms", async () => {
    render(<MemoryRouter initialEntries={["/clients"]}><App /></MemoryRouter>);
    await screen.findByText("ABC Cafe");
    fireEvent.click(screen.getByRole("button", { name: "Add Client" }));
    fireEvent.change(screen.getByLabelText(/Client name/), { target: { value: "Orbit Web Studio" } });
    fireEvent.change(screen.getByLabelText(/Brand name/), { target: { value: "Orbit" } });
    fireEvent.change(screen.getByLabelText("Industry"), { target: { value: "Web Development" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText(/Brand voice/), { target: { value: "Professional but friendly" } });
    fireEvent.change(screen.getByLabelText("Preferred CTA"), { target: { value: "Book a free consultation" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: /Instagram/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create client" }));
    expect(await screen.findByText("Orbit Web Studio")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Client created locally");
  });

  it("opens the client workspace and displays its Brand Profile", async () => {
    render(<MemoryRouter initialEntries={["/clients/preview-abc-cafe"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "ABC Cafe" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Brand Profile" }));
    expect(screen.getByText("Friendly, energetic and local")).toBeInTheDocument();
    expect(screen.getByText("Visit us this weekend")).toBeInTheDocument();
  });

  it("archives and restores a client without losing its data", async () => {
    render(<MemoryRouter initialEntries={["/clients"]}><App /></MemoryRouter>);
    await screen.findByText("ABC Cafe");
    fireEvent.click(screen.getByRole("button", { name: "Actions for ABC Cafe" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive client" }));
    await waitFor(() => expect(screen.queryByText("ABC Cafe")).not.toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox", { name: "Filter clients" }), { target: { value: "archived" } });
    expect(await screen.findByText("ABC Cafe")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actions for ABC Cafe" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore client" }));
    await waitFor(() => expect(screen.queryByText("ABC Cafe")).not.toBeInTheDocument());
  });
});

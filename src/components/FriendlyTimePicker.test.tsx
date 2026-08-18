import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { FriendlyTimePicker } from "./FriendlyTimePicker";

function ControlledPicker() {
  const [value, setValue] = useState("");
  return <><FriendlyTimePicker label="Proposed time" value={value} onChange={setValue} /><output aria-label="stored time">{value}</output></>;
}

describe("FriendlyTimePicker", () => {
  afterEach(() => cleanup());

  it("changes hour, minute and period without relying on the native segmented time field", () => {
    render(<ControlledPicker />);

    fireEvent.change(screen.getByRole("combobox", { name: "Proposed time hour" }), { target: { value: "4" } });
    expect(screen.getByLabelText("stored time")).toHaveTextContent("04:00");

    fireEvent.change(screen.getByRole("combobox", { name: "Proposed time minute" }), { target: { value: "30" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Proposed time period" }), { target: { value: "PM" } });
    expect(screen.getByLabelText("stored time")).toHaveTextContent("16:30");
  });

  it("offers one-click publishing-time choices and a clear control", () => {
    render(<ControlledPicker />);
    fireEvent.click(screen.getByRole("button", { name: "6 PM" }));
    expect(screen.getByLabelText("stored time")).toHaveTextContent("18:00");
    fireEvent.click(screen.getByRole("button", { name: "Clear proposed time" }));
    expect(screen.getByLabelText("stored time")).toBeEmptyDOMElement();
  });
});

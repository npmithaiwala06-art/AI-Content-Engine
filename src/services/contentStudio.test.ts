import { describe, expect, it } from "vitest";
import { buildContentAssistPrompt } from "./contentStudio";
import { emptyContentPost, emptyVersion } from "../types/content";

describe("content studio manual AI workflow", () => {
  it("builds a platform-specific prompt without an API", () => {
    const post = { ...emptyContentPost(), title: "Weekend Offer", topic: "Coffee", goal: "Increase visits" };
    const version = { ...emptyVersion("instagram"), caption: "Fresh coffee this weekend", cta: "Visit us" };
    const prompt = buildContentAssistPrompt("rewrite", "ABC Cafe", post, version);
    expect(prompt).toContain("CLIENT: ABC Cafe");
    expect(prompt).toContain("PLATFORM: instagram");
    expect(prompt).toContain("Do not duplicate another platform's wording");
  });
});

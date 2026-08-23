import { describe, expect, it } from "vitest";
import { parseCreativePackage } from "./localCreativeRenderer";

describe("parseCreativePackage", () => {
  it("parses the strict SocialFlow media response", () => {
    const creative = parseCreativePackage(JSON.stringify({
      campaign_name: "AI Launch",
      brand_name: "SocialFlow OS",
      headline: "One brief. A full campaign.",
      subheadline: "Create faster with your existing brand memory.",
      cta: "Try SocialFlow",
      palette: ["#160A3A", "#6D4AFF", "#18A98C"],
      image: { visual_prompt: "Premium product ad", overlay_text: "Create faster", caption: "Meet SocialFlow" },
      video: {
        duration_seconds: 10,
        caption: "Meet SocialFlow",
        scenes: [
          { duration_seconds: 2, headline: "Hook", on_screen_text: "Still writing every post?", visual_direction: "Fast kinetic text" },
          { duration_seconds: 3, headline: "Solution", on_screen_text: "Use Brand Memory", visual_direction: "Show the workspace" },
          { duration_seconds: 3, headline: "Value", on_screen_text: "One brief, every platform", visual_direction: "Cards multiply" },
          { duration_seconds: 2, headline: "CTA", on_screen_text: "Try SocialFlow", visual_direction: "Clean CTA frame" },
        ],
      },
    }), "");

    expect(creative.campaignName).toBe("AI Launch");
    expect(creative.image?.overlayText).toBe("Create faster");
    expect(creative.video?.scenes).toHaveLength(4);
    expect(creative.video?.durationSeconds).toBe(10);
  });

  it("recovers useful creative from the existing AI Workspace output", () => {
    const creative = parseCreativePackage(JSON.stringify({
      posts: [{ platforms: { instagram: { hook: "Stop planning posts manually", caption: "SocialFlow builds the campaign.", cta: "Book a demo", creative_idea: "Product UI reveal" } } }],
    }), "Brand: SocialFlow OS\nGoal: Increase product awareness");

    expect(creative.brandName).toBe("SocialFlow OS");
    expect(creative.headline).toBe("Stop planning posts manually");
    expect(creative.cta).toBe("Book a demo");
  });

  it("uses the client brief safely if Codex returns non-JSON text", () => {
    const creative = parseCreativePackage("Here is your campaign", "Client: ABC Cafe\nGoal: Increase weekend visits\nTopic: Weekend brunch\nPreferred CTA: Visit us");

    expect(creative.brandName).toBe("ABC Cafe");
    expect(creative.headline).toBe("Increase weekend visits");
    expect(creative.cta).toBe("Visit us");
    expect(creative.video?.scenes.length).toBeGreaterThanOrEqual(3);
  });
});

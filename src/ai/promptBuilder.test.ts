import { describe, expect, it } from "vitest";
import { buildChatGptPrompt } from "./promptBuilder";
import type { ClientDetail } from "../types/client";

const client: ClientDetail = {
  id: "client-abc",
  clientName: "ABC Cafe",
  companyName: "ABC Foods Pvt. Ltd.",
  brandName: "ABC Cafe",
  industry: "Cafe",
  website: "https://abc.example",
  location: "Surat, Gujarat",
  businessDescription: "A neighbourhood specialty coffee shop.",
  products: ["Coffee", "Breakfast bowls"],
  services: ["Dine-in", "Takeaway"],
  targetAudience: "College students and young professionals",
  marketingGoals: ["Increase weekend visits"],
  competitors: ["Local coffee chains"],
  postingFrequency: "4 posts per week",
  mainPlatforms: ["instagram", "facebook"],
  status: "active",
  createdAt: "2026-08-01T10:00:00Z",
  updatedAt: "2026-08-14T10:00:00Z",
  brandProfile: {
    brandVoice: "Friendly, energetic and local",
    brandPersonality: ["Welcoming", "Playful"],
    brandColours: ["#6D4AFF"],
    fonts: ["DM Sans"],
    primaryAudience: "College students and young professionals",
    preferredCta: "Visit us this weekend",
    contentStyle: "Food photography and short reels",
    keywords: ["Surat cafe", "weekend brunch"],
    topicsToAvoid: ["Overly formal language"],
  },
  stats: { draftPosts: 0, approvedPosts: 0, scheduledPosts: 0, publishedPosts: 0, connectedPlatforms: 0 },
};

describe("Phase 3 ChatGPT prompt builder", () => {
  it("includes Brand Memory, platform-native instructions and import-ready JSON", () => {
    const prompt = buildChatGptPrompt({
      client,
      input: {
        clientId: client.id,
        campaignId: "",
        templateType: "7_day",
        goal: "Increase weekend customers",
        topic: "Weekend coffee and brunch",
        contentType: "mixed",
        tone: "Friendly",
        platforms: ["instagram", "facebook"],
        postCount: 7,
        startDate: "2026-08-17",
        endDate: "2026-08-23",
      },
    });

    expect(prompt).toContain("Brand voice: Friendly, energetic and local");
    expect(prompt).toContain("Preferred CTA: Visit us this weekend");
    expect(prompt).toContain("Instagram requirements:");
    expect(prompt).toContain("Facebook requirements:");
    expect(prompt).not.toContain("YouTube requirements:");
    expect(prompt).toContain("Never duplicate the exact caption across platforms");
    expect(prompt).toContain('"format_version": "social_content_v1"');
    expect(prompt).toContain("Return exactly one valid JSON object");
  });
});

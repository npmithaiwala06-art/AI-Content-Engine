import { describe, expect, it, vi } from "vitest";
import type { ClientDetail } from "../types/client";
import type { AiWorkspaceInput } from "../types/aiWorkspace";
import { executeCampaignAutomation } from "./campaignAutomation";

const client = {
  id: "client-1",
  clientName: "Sustro",
  companyName: "Sustro Speciality Oils",
  brandName: "Sustro",
  industry: "Speciality oils",
  website: "",
  location: "India",
  businessDescription: "B2B speciality oil supplier",
  products: ["Speciality oils"],
  services: [],
  targetAudience: "Manufacturers",
  marketingGoals: ["Qualified enquiries"],
  competitors: [],
  postingFrequency: "weekly",
  mainPlatforms: ["instagram"],
  status: "active",
  createdAt: "2026-08-23T00:00:00Z",
  updatedAt: "2026-08-23T00:00:00Z",
  brandProfile: {
    brandVoice: "Professional",
    brandPersonality: ["Reliable"],
    brandColours: ["#123456"],
    fonts: [],
    primaryAudience: "Manufacturers",
    preferredCta: "Contact Mr. Venu",
    contentStyle: "Brand-led",
    keywords: ["speciality oils"],
    topicsToAvoid: [],
  },
  stats: { draftPosts: 0, approvedPosts: 0, scheduledPosts: 0, publishedPosts: 0, connectedPlatforms: 1 },
} satisfies ClientDetail;

const input = {
  clientId: client.id,
  campaignId: "",
  templateType: "7_day",
  goal: "Generate qualified enquiries",
  topic: "Reliable supply for manufacturers",
  contentType: "image_post",
  tone: "Professional",
  platforms: ["instagram"],
  postCount: 1,
  startDate: "2026-08-24",
  endDate: "2026-08-30",
} satisfies AiWorkspaceInput;

const response = JSON.stringify({
  format_version: "social_content_v1",
  client_id: client.id,
  posts: [{
    title: "Reliable supply",
    topic: "Supply confidence",
    goal: input.goal,
    content_type: "image_post",
    scheduled_date: "2026-08-24",
    recommended_time: "10:00",
    platforms: { instagram: { hook: "Keep production moving", caption: "Dependable speciality oils for manufacturers.", cta: "Contact Mr. Venu", image_prompt: "Industrial speciality oils brand creative" } },
  }],
});

describe("executeCampaignAutomation", () => {
  it("submits one master prompt and saves the structured campaign once", async () => {
    const generate = vi.fn().mockResolvedValue({ provider: "codex_chatgpt_subscription", model: "codex", content: response, elapsedMs: 10 });
    const savePrompt = vi.fn().mockResolvedValue("prompt-1");
    const saveImport = vi.fn().mockResolvedValue({ batchId: "batch-1", savedPostIds: ["post-1"], duplicateTempIds: [] });

    const result = await executeCampaignAutomation({ client, input, recommendations: [], mode: "manual_approval" }, {
      generate,
      savePrompt,
      checkDuplicates: vi.fn().mockResolvedValue([]),
      saveImport,
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(savePrompt).toHaveBeenCalledTimes(1);
    expect(saveImport).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0]).toContain("CLIENT AND BRAND MEMORY");
    expect(generate.mock.calls[0][0]).toContain(input.goal);
    expect(generate.mock.calls[0][0]).toContain(input.topic);
    expect(result.savedPostIds).toEqual(["post-1"]);
    expect(result.mode).toBe("manual_approval");
  });

  it("does not save duplicate generated posts", async () => {
    const saveImport = vi.fn().mockResolvedValue({ batchId: "batch-1", savedPostIds: [], duplicateTempIds: ["import-1"] });
    const result = await executeCampaignAutomation({ client, input, recommendations: [], mode: "auto_schedule" }, {
      generate: vi.fn().mockResolvedValue({ provider: "codex_chatgpt_subscription", model: "codex", content: response, elapsedMs: 10 }),
      savePrompt: vi.fn().mockResolvedValue("prompt-1"),
      checkDuplicates: vi.fn().mockResolvedValue(["import-1"]),
      saveImport,
    });

    expect(saveImport).not.toHaveBeenCalled();
    expect(result.savedPostIds).toEqual([]);
    expect(result.duplicateTempIds).toEqual(["import-1"]);
  });

  it("approves and schedules every saved post only in an automated mode", async () => {
    const activatePost = vi.fn().mockResolvedValue(undefined);
    await executeCampaignAutomation({ client, input, recommendations: [], mode: "full_autopilot", accountIds: { instagram: "account-1" } }, {
      generate: vi.fn().mockResolvedValue({ provider: "codex_chatgpt_subscription", model: "codex", content: response, elapsedMs: 10 }),
      savePrompt: vi.fn().mockResolvedValue("prompt-1"),
      checkDuplicates: vi.fn().mockResolvedValue([]),
      saveImport: vi.fn().mockResolvedValue({ batchId: "batch-1", savedPostIds: ["post-1"], duplicateTempIds: [] }),
      activatePost,
    });
    expect(activatePost).toHaveBeenCalledOnce();
    expect(activatePost).toHaveBeenCalledWith("post-1", "full_autopilot", { instagram: "account-1" });
  });
});

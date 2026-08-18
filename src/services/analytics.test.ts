import { describe, expect, it } from "vitest";
import { parseRecommendations } from "./analytics";

const recommendation = {
  findings: ["Reels won"],
  successful_topics: ["Education"],
  weak_topics: [],
  successful_formats: ["reel"],
  weak_formats: ["promo"],
  posting_recommendations: ["4 weekly"],
  strategy_recommendations: ["Increase reels"],
  future_ideas: ["Tutorial"],
};

describe("AI recommendations importer", () => {
  it("extracts fenced structured learning without manual JSON editing", () => {
    const parsed = parseRecommendations(
      `Analysis\n\`\`\`json\n${JSON.stringify(recommendation)}\n\`\`\``,
      "client",
      "2026-08-01",
      "2026-08-31",
    );
    expect(parsed.strategyRecommendations).toEqual(["Increase reels"]);
    expect(parsed.futureIdeas).toEqual(["Tutorial"]);
  });

  it("selects the recommendation object when ChatGPT includes other JSON first", () => {
    const raw = `Metrics:\n${JSON.stringify({ totalReach: 40000, posts: [] })}\n\nRecommendations:\n${JSON.stringify(recommendation)}`;
    const parsed = parseRecommendations(raw, "client", "2026-08-01", "2026-08-31");
    expect(parsed.findings).toEqual(["Reels won"]);
    expect(parsed.strategyRecommendations).toEqual(["Increase reels"]);
  });

  it("accepts camelCase recommendation keys", () => {
    const parsed = parseRecommendations(
      JSON.stringify({ findings: ["Strong month"], strategyRecommendations: "Continue education", futureIdeas: ["FAQ Reel"] }),
      "client",
      "2026-08-01",
      "2026-08-31",
    );
    expect(parsed.strategyRecommendations).toEqual(["Continue education"]);
  });

  it("explains when the analytics prompt was pasted instead of ChatGPT's answer", () => {
    expect(() =>
      parseRecommendations(
        'You are a senior social-media strategist.\nMETRICS JSON:\n{"totalReach":0}\nGive: 1) overall performance',
        "client",
        "2026-08-01",
        "2026-08-31",
      ),
    ).toThrow("This is the analytics prompt, not ChatGPT's answer");
  });
});

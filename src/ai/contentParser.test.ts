import { describe, expect, it } from "vitest";
import { ContentParseError, parseChatGptContent } from "./contentParser";

const valid = {
  format_version: "social_content_v1",
  client_id: "client-1",
  posts: [{ title: "Launch", topic: "New service", content_type: "image_post", platforms: { instagram: { hook: "Meet what is next", caption: "Our new service is here.", hashtags: ["#Launch"] }, twitter: { hook: "A new chapter", caption: "We are expanding our services." } } }],
};

describe("Phase 4 content parser", () => {
  it("extracts fenced JSON and normalises independent platform versions", () => {
    const parsed = parseChatGptContent(`Here is the result:\n\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``);
    expect(parsed.formatVersion).toBe("social_content_v1");
    expect(parsed.clientIdHint).toBe("client-1");
    expect(parsed.posts).toHaveLength(1);
    expect(parsed.posts[0].platforms.map((version) => version.platform)).toEqual(["instagram", "twitter"]);
    expect(parsed.posts[0].platforms[0].caption).not.toBe(parsed.posts[0].platforms[1].caption);
  });

  it("returns actionable validation issues instead of partially saving invalid content", () => {
    expect(() => parseChatGptContent('{"format_version":"social_content_v1","posts":[{"title":"Broken"}]}')).toThrow(ContentParseError);
    try { parseChatGptContent("not json"); } catch (error) {
      expect(error).toBeInstanceOf(ContentParseError);
      expect((error as ContentParseError).issues[0]).toContain("Phase 3 prompt");
    }
  });
});

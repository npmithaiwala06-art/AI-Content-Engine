import { describe, expect, it, vi } from "vitest";
import { MediaProviderRegistry, type MediaGenerationProvider } from "./mediaGeneration";

function provider(id: string, capabilities: Array<"image" | "video">): MediaGenerationProvider {
  return { id, label: id, capabilities, generate: vi.fn().mockResolvedValue([]) };
}

describe("MediaProviderRegistry", () => {
  it("routes image and video jobs to independently configured adapters", async () => {
    const image = provider("image-api", ["image"]);
    const video = provider("video-api", ["video"]);
    const registry = new MediaProviderRegistry([image, video], { image: image.id, video: video.id });

    await registry.generate({ kind: "image", sourceContent: "{}", sourcePrompt: "image prompt" });
    await registry.generate({ kind: "video", sourceContent: "{}", sourcePrompt: "video prompt" });

    expect(image.generate).toHaveBeenCalledTimes(1);
    expect(video.generate).toHaveBeenCalledTimes(1);
  });

  it("refuses a provider that cannot generate the requested media kind", async () => {
    const image = provider("image-only", ["image"]);
    const registry = new MediaProviderRegistry([image], { image: image.id, video: image.id });
    await expect(registry.generate({ kind: "video", sourceContent: "{}", sourcePrompt: "video prompt" }))
      .rejects.toThrow("does not support video");
  });
});

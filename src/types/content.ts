import type { PlatformKey } from "./client";

export interface PostSummary {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  topic: string;
  contentType: string;
  status: string;
  source: string;
  platforms: PlatformKey[];
  proposedPublishAt?: string;
  updatedAt: string;
}

export interface PostVersion {
  id?: string;
  platform: PlatformKey;
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
  title: string;
  description: string;
  keywords: string[];
  creativeIdea: string;
  imagePrompt: string;
  thumbnailConcept: string;
  postFormat: string;
  videoFormat: string;
  officialMediaUrl: string;
  privacyStatus: string;
  categoryId: string;
}

export interface PostDetail {
  id: string;
  clientId: string;
  campaignId?: string;
  title: string;
  topic: string;
  contentType: string;
  goal: string;
  status: string;
  source: string;
  proposedDate: string;
  proposedTime: string;
  timezone: string;
  versions: PostVersion[];
}

export type ContentPostInput = Omit<PostDetail, "id" | "status" | "source">;

export const emptyVersion = (platform: PlatformKey): PostVersion => ({
  platform, hook: "", caption: "", cta: "", hashtags: [], title: "", description: "",
  keywords: [], creativeIdea: "", imagePrompt: "", thumbnailConcept: "", postFormat: "",
  videoFormat: "",
  officialMediaUrl: "", privacyStatus: "private", categoryId: "22",
});

export const emptyContentPost = (): ContentPostInput => ({
  clientId: "", title: "", topic: "", contentType: "image_post", goal: "",
  proposedDate: "", proposedTime: "", timezone: "Asia/Kolkata",
  versions: [emptyVersion("instagram")],
});

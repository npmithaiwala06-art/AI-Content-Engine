import type { PlatformKey } from "./client";

export interface ImportedPlatformDraft {
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

export interface ImportedPostDraft {
  tempId: string;
  title: string;
  topic: string;
  goal: string;
  contentType: string;
  scheduledDate?: string;
  recommendedTime?: string;
  timezone?: string;
  platforms: ImportedPlatformDraft[];
}

export interface ParsedContentImport {
  formatVersion: string;
  clientIdHint?: string;
  clientNameHint?: string;
  campaignName?: string;
  posts: ImportedPostDraft[];
  warnings: string[];
}

export interface SaveContentImportInput {
  clientId: string;
  campaignId?: string;
  aiPromptId?: string;
  rawContent: string;
  parsedPostCount: number;
  posts: ImportedPostDraft[];
}

export interface ContentImportSaveResult {
  batchId: string;
  savedPostIds: string[];
  duplicateTempIds: string[];
}

export interface PreviewStoredPost extends ImportedPostDraft {
  id: string;
  clientId: string;
  campaignId?: string;
  status: "draft";
  source: "chatgpt_import";
  createdAt: string;
  importFingerprint: string;
}

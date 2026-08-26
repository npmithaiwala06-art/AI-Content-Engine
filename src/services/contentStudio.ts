import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "./desktop";
import { listPreviewDraftPosts } from "./contentImport";
import { listClients } from "./clients";
import type { PlatformKey } from "../types/client";
import type { ContentPostInput, PostDetail, PostSummary, PostVersion } from "../types/content";

const manualKey = "socialflow.preview.manualPosts.v1";
const supportedPlatformSet = new Set<PlatformKey>(["instagram", "facebook", "twitter", "youtube"]);

export function normalizeContentPlatform(value: string): PlatformKey | undefined {
  const normalized = value === "x" ? "twitter" : value;
  return supportedPlatformSet.has(normalized as PlatformKey) ? normalized as PlatformKey : undefined;
}

function normalizeVersions(versions: PostVersion[]): PostVersion[] {
  return versions.flatMap((version) => {
    const platform = normalizeContentPlatform(String(version.platform));
    return platform ? [{ ...version, platform }] : [];
  });
}

function normalizePostDetail(post: PostDetail): PostDetail {
  return { ...post, versions: normalizeVersions(post.versions) };
}

function normalizePostSummary(post: PostSummary): PostSummary {
  return {
    ...post,
    platforms: post.platforms.flatMap((value) => {
      const platform = normalizeContentPlatform(String(value));
      return platform ? [platform] : [];
    }),
  };
}

type PreviewPost = PostDetail & { updatedAt: string };

const loadManual = (): PreviewPost[] => {
  try { return JSON.parse(localStorage.getItem(manualKey) ?? "[]") as PreviewPost[]; }
  catch { return []; }
};
const saveManual = (posts: PreviewPost[]) => localStorage.setItem(manualKey, JSON.stringify(posts));

async function previewPosts(): Promise<PreviewPost[]> {
  const manual = loadManual();
  const imported = listPreviewDraftPosts().map<PreviewPost>((post) => ({
    id: post.id, clientId: post.clientId, campaignId: post.campaignId, title: post.title, topic: post.topic,
    contentType: post.contentType, goal: post.goal, status: post.status, source: post.source,
    proposedDate: post.scheduledDate ?? "", proposedTime: post.recommendedTime ?? "",
    timezone: post.timezone ?? "Asia/Kolkata", updatedAt: post.createdAt,
    versions: post.platforms.map((version) => ({ ...version })),
  }));
  const editedIds = new Set(manual.map((post) => post.id));
  return [...manual, ...imported.filter((post) => !editedIds.has(post.id))];
}

export async function listPosts(filters: { clientId?: string; status?: string; search?: string } = {}): Promise<PostSummary[]> {
  if (isDesktopRuntime()) return (await invoke<PostSummary[]>("list_posts", filters)).map(normalizePostSummary);
  const clients = await listClients({ filter: "all" });
  const names = new Map(clients.map((client) => [client.id, client.clientName]));
  const query = filters.search?.trim().toLowerCase() ?? "";
  return (await previewPosts()).filter((post) => (!filters.clientId || post.clientId === filters.clientId)
    && (!filters.status || filters.status === "all" || post.status === filters.status)
    && (!query || `${post.title} ${post.topic}`.toLowerCase().includes(query)))
    .map((post) => ({ id: post.id, clientId: post.clientId, clientName: names.get(post.clientId) ?? "Unknown client", title: post.title,
      topic: post.topic, contentType: post.contentType, status: post.status, source: post.source,
      platforms: normalizeVersions(post.versions).map((version) => version.platform), proposedPublishAt: post.proposedDate ? `${post.proposedDate}T${post.proposedTime || "09:00"}:00` : undefined,
      updatedAt: post.updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getPost(postId: string): Promise<PostDetail> {
  if (isDesktopRuntime()) return normalizePostDetail(await invoke<PostDetail>("get_post", { postId }));
  const post = (await previewPosts()).find((item) => item.id === postId);
  if (!post) throw new Error("Post not found");
  return normalizePostDetail(structuredClone(post));
}

export async function savePost(postId: string | undefined, input: ContentPostInput): Promise<string> {
  if (isDesktopRuntime()) return invoke<string>("save_post", { postId, input });
  if (!input.clientId || !input.title.trim() || !input.topic.trim() || input.versions.length === 0) throw new Error("Client, title, topic and at least one platform are required.");
  const id = postId ?? globalThis.crypto?.randomUUID?.() ?? `post-${Date.now()}`;
  const existing = await previewPosts();
  const current = existing.find((post) => post.id === id);
  if (current && ["published", "publishing"].includes(current.status)) throw new Error("Publishing or Published posts cannot be changed.");
  const record: PreviewPost = { id, ...structuredClone(input), status: "draft", source: current?.source ?? "manual", updatedAt: new Date().toISOString() };
  saveManual([record, ...loadManual().filter((post) => post.id !== id)]);
  return id;
}

export async function duplicatePost(postId: string): Promise<string> {
  if (isDesktopRuntime()) return invoke<string>("duplicate_post", { postId });
  const source = await getPost(postId); const id = globalThis.crypto?.randomUUID?.() ?? `post-${Date.now()}`;
  saveManual([{ ...source, id, title: `${source.title} — Copy`, status: "draft", source: "duplicate", updatedAt: new Date().toISOString() }, ...loadManual()]);
  return id;
}

export async function submitPostForReview(postId: string): Promise<void> {
  if (isDesktopRuntime()) return invoke<void>("submit_post_for_review", { postId });
  const post = await getPost(postId); if (!["draft", "rejected"].includes(post.status)) throw new Error("Only Draft or Rejected posts can be submitted.");
  saveManual([{ ...post, status: "needs_review", updatedAt: new Date().toISOString() }, ...loadManual().filter((item) => item.id !== postId)]);
}

export async function deleteDraftPost(postId: string): Promise<void> {
  if (isDesktopRuntime()) return invoke<void>("delete_draft_post", { postId });
  const post = await getPost(postId); if (!["draft", "rejected", "paused"].includes(post.status)) throw new Error("Only editable posts can be deleted.");
  saveManual(loadManual().filter((item) => item.id !== postId));
}

export function buildContentAssistPrompt(kind: "rewrite" | "hashtags" | "cta", clientName: string, post: ContentPostInput, version: PostVersion): string {
  const task = kind === "rewrite" ? `Rewrite this ${version.platform} content while preserving the goal and brand intent. Return a distinct platform-native hook, caption, CTA and hashtags.`
    : kind === "hashtags" ? `Create a focused hashtag and keyword set for this ${version.platform} post. Avoid spammy or irrelevant tags.`
      : `Create five clear, platform-appropriate CTA options for this ${version.platform} post.`;
  return `You are a professional social-media editor.\n\nCLIENT: ${clientName}\nPLATFORM: ${version.platform}\nTITLE: ${post.title}\nTOPIC: ${post.topic}\nGOAL: ${post.goal}\nCONTENT TYPE: ${post.contentType}\nCURRENT HOOK: ${version.hook}\nCURRENT CONTENT: ${version.caption || version.description}\nCURRENT CTA: ${version.cta}\n\nTASK:\n${task}\n\nDo not duplicate another platform's wording. Return only the requested content in clear labelled sections.`;
}

export const supportedPlatforms: PlatformKey[] = ["instagram", "facebook", "twitter", "youtube"];

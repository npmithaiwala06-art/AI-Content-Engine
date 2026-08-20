import { invoke } from "@tauri-apps/api/core";
import type { ContentImportSaveResult, ImportedPostDraft, PreviewStoredPost, SaveContentImportInput } from "../types/contentImport";

const previewPostsKey = "socialflow.preview.posts.v1";
const pendingGeneratedContentKey = "socialflow.pendingGeneratedContent.v1";

export interface PendingGeneratedContent {
  rawContent: string;
  clientId: string;
  aiPromptId?: string;
}

export function stageGeneratedContent(input: PendingGeneratedContent): void {
  sessionStorage.setItem(pendingGeneratedContentKey, JSON.stringify(input));
}

export function takeStagedGeneratedContent(): PendingGeneratedContent | undefined {
  const value = sessionStorage.getItem(pendingGeneratedContentKey);
  if (!value) return undefined;
  sessionStorage.removeItem(pendingGeneratedContentKey);
  try {
    return JSON.parse(value) as PendingGeneratedContent;
  } catch {
    return undefined;
  }
}

function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function normalise(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function fingerprint(post: ImportedPostDraft): string {
  const versions = post.platforms.map((version) => `${version.platform}:${normalise(version.title)}:${normalise(version.hook)}:${normalise(`${version.caption} ${version.description}`)}`).sort();
  const signature = `${normalise(post.title)}|${normalise(post.topic)}|${normalise(post.contentType)}|${versions.join("|")}`;
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function loadPreviewPosts(): PreviewStoredPost[] {
  try { return JSON.parse(localStorage.getItem(previewPostsKey) ?? "[]") as PreviewStoredPost[]; } catch { return []; }
}

export async function checkContentImportDuplicates(clientId: string, posts: ImportedPostDraft[]): Promise<string[]> {
  if (isDesktopRuntime()) return invoke<string[]>("check_import_duplicates", { clientId, posts });
  const existing = new Set(loadPreviewPosts().filter((post) => post.clientId === clientId).map((post) => post.importFingerprint));
  return posts.filter((post) => existing.has(fingerprint(post))).map((post) => post.tempId);
}

export async function saveContentImport(input: SaveContentImportInput): Promise<ContentImportSaveResult> {
  if (isDesktopRuntime()) return invoke<ContentImportSaveResult>("save_content_import", { input });
  const stored = loadPreviewPosts();
  const existing = new Set(stored.filter((post) => post.clientId === input.clientId).map((post) => post.importFingerprint));
  const savedPostIds: string[] = [];
  const duplicateTempIds: string[] = [];
  for (const post of input.posts) {
    const importFingerprint = fingerprint(post);
    if (existing.has(importFingerprint)) { duplicateTempIds.push(post.tempId); continue; }
    existing.add(importFingerprint);
    const id = globalThis.crypto?.randomUUID?.() ?? `post-${Date.now()}-${savedPostIds.length}`;
    stored.unshift({ ...post, id, clientId: input.clientId, status: "draft", source: "chatgpt_import", createdAt: new Date().toISOString(), importFingerprint });
    savedPostIds.push(id);
  }
  localStorage.setItem(previewPostsKey, JSON.stringify(stored));
  return { batchId: globalThis.crypto?.randomUUID?.() ?? `batch-${Date.now()}`, savedPostIds, duplicateTempIds };
}

export function listPreviewDraftPosts(): PreviewStoredPost[] {
  return loadPreviewPosts();
}

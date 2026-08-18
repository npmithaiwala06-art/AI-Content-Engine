import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "./desktop";
import type { ClientDetail, ClientInput, ClientListOptions, ClientSummary, PlatformKey } from "../types/client";

const previewKey = "socialflow.previewClients.v2";

const previewClients: ClientDetail[] = [
  {
    id: "preview-abc-cafe", clientName: "ABC Cafe", companyName: "ABC Foods Pvt. Ltd.", brandName: "ABC Cafe", industry: "Cafe & Restaurant", website: "https://example.com", location: "Surat, Gujarat", businessDescription: "A lively neighbourhood cafe serving specialty coffee and quick comfort food.", products: ["Specialty coffee", "Cold brews", "Breakfast bowls"], services: ["Dine-in", "Takeaway", "Small events"], targetAudience: "College students and young professionals in Surat", marketingGoals: ["Increase weekend visits", "Grow local awareness"], competitors: ["Local coffee chains", "Independent cafes"], postingFrequency: "4 posts per week", mainPlatforms: ["instagram", "facebook"], status: "active", createdAt: "2026-07-02T10:00:00Z", updatedAt: "2026-08-14T08:20:00Z", brandProfile: { brandVoice: "Friendly, energetic and local", brandPersonality: ["Welcoming", "Playful", "Optimistic"], brandColours: ["#6D4AFF", "#F59E0B", "#FFF7E8"], fonts: ["DM Sans", "Manrope"], primaryAudience: "College students and young professionals in Surat", preferredCta: "Visit us this weekend", contentStyle: "Food photography, short reels and offer-led stories", keywords: ["coffee", "Surat cafe", "weekend brunch"], topicsToAvoid: ["Overly formal language", "Technical coffee jargon"] }, stats: { draftPosts: 7, approvedPosts: 3, scheduledPosts: 5, publishedPosts: 42, connectedPlatforms: 2 }, socialAccountCount: 2, scheduledPostCount: 5, lastActivity: "2026-08-14T08:20:00Z",
  } as ClientDetail & ClientSummary,
  {
    id: "preview-northstar", clientName: "Northstar Studio", companyName: "Northstar Design Studio", brandName: "Northstar", industry: "Brand Design", website: "https://northstar.example", location: "Mumbai, Maharashtra", businessDescription: "A strategic brand and digital design studio for ambitious consumer businesses.", products: ["Brand systems"], services: ["Brand strategy", "Visual identity", "Web design"], targetAudience: "Founders and marketing leaders", marketingGoals: ["Generate qualified enquiries", "Build authority"], competitors: ["Independent design studios"], postingFrequency: "3 posts per week", mainPlatforms: ["instagram", "linkedin"], status: "active", createdAt: "2026-06-10T10:00:00Z", updatedAt: "2026-08-13T13:10:00Z", brandProfile: { brandVoice: "Sharp, insightful and confident", brandPersonality: ["Strategic", "Modern", "Direct"], brandColours: ["#111827", "#8B5CF6", "#F8FAFC"], fonts: ["Inter"], primaryAudience: "Founders and marketing leaders", preferredCta: "Start a brand conversation", contentStyle: "Editorial carousels and polished case studies", keywords: ["branding", "design strategy"], topicsToAvoid: ["Cheap design claims"] }, stats: { draftPosts: 4, approvedPosts: 2, scheduledPosts: 3, publishedPosts: 28, connectedPlatforms: 2 }, socialAccountCount: 2, scheduledPostCount: 3, lastActivity: "2026-08-13T13:10:00Z",
  } as ClientDetail & ClientSummary,
  {
    id: "preview-mira", clientName: "Mira Wellness", companyName: "Mira Wellness LLP", brandName: "Mira", industry: "Health & Wellness", website: "https://mira.example", location: "Ahmedabad, Gujarat", businessDescription: "Evidence-informed wellness coaching for busy professionals.", products: ["Wellness plans"], services: ["Nutrition coaching", "Habit coaching"], targetAudience: "Busy professionals aged 25–45", marketingGoals: ["Increase consultation bookings"], competitors: ["Online wellness coaches"], postingFrequency: "5 posts per week", mainPlatforms: ["instagram", "youtube"], status: "paused", createdAt: "2026-05-15T10:00:00Z", updatedAt: "2026-08-10T09:00:00Z", brandProfile: { brandVoice: "Calm, credible and encouraging", brandPersonality: ["Supportive", "Grounded"], brandColours: ["#0F766E", "#CCFBF1"], fonts: ["Avenir"], primaryAudience: "Busy professionals aged 25–45", preferredCta: "Book a discovery call", contentStyle: "Educational videos and practical checklists", keywords: ["wellness", "healthy habits"], topicsToAvoid: ["Medical promises"] }, stats: { draftPosts: 2, approvedPosts: 0, scheduledPosts: 0, publishedPosts: 19, connectedPlatforms: 1 }, socialAccountCount: 1, scheduledPostCount: 0, lastActivity: "2026-08-10T09:00:00Z",
  } as ClientDetail & ClientSummary,
];

function loadPreviewClients(): ClientDetail[] {
  const stored = localStorage.getItem(previewKey);
  if (!stored) {
    localStorage.setItem(previewKey, JSON.stringify(previewClients));
    return structuredClone(previewClients);
  }
  try { return JSON.parse(stored) as ClientDetail[]; } catch { return structuredClone(previewClients); }
}

function savePreviewClients(clients: ClientDetail[]) {
  localStorage.setItem(previewKey, JSON.stringify(clients));
}

function toSummary(client: ClientDetail): ClientSummary {
  return { id: client.id, clientName: client.clientName, brandName: client.brandName || client.companyName || client.clientName, industry: client.industry, location: client.location, socialAccountCount: client.stats.connectedPlatforms, scheduledPostCount: client.stats.scheduledPosts, status: client.status, lastActivity: client.updatedAt, logoPath: client.logoPath, mainPlatforms: client.mainPlatforms };
}

function inputToDetail(id: string, input: ClientInput, existing?: ClientDetail): ClientDetail {
  const now = new Date().toISOString();
  return { id, ...input, createdAt: existing?.createdAt ?? now, updatedAt: now, archivedAt: existing?.archivedAt, brandProfile: { brandVoice: input.brandVoice, brandPersonality: input.brandPersonality, brandColours: input.brandColours, fonts: input.fonts, primaryAudience: input.targetAudience, preferredCta: input.preferredCta, contentStyle: input.contentStyle, keywords: input.keywords, topicsToAvoid: input.topicsToAvoid }, stats: existing?.stats ?? { draftPosts: 0, approvedPosts: 0, scheduledPosts: 0, publishedPosts: 0, connectedPlatforms: 0 }, logoPath: existing?.logoPath };
}

export function clientLogoUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("data:") || path.startsWith("blob:")) return path;
  return isDesktopRuntime() ? convertFileSrc(path) : path;
}

export async function listClients(options: ClientListOptions = {}): Promise<ClientSummary[]> {
  if (isDesktopRuntime()) return invoke<ClientSummary[]>("list_clients", { search: options.search, filter: options.filter, sort: options.sort });
  const query = options.search?.trim().toLowerCase() ?? "";
  const filter = options.filter ?? "active";
  const result = loadPreviewClients().filter((client) => (filter === "all" || client.status === filter) && (!query || `${client.clientName} ${client.brandName} ${client.industry} ${client.location}`.toLowerCase().includes(query))).map(toSummary);
  return result.sort((a, b) => options.sort === "name" ? a.clientName.localeCompare(b.clientName) : options.sort === "industry" ? a.industry.localeCompare(b.industry) : options.sort === "oldest" ? a.lastActivity.localeCompare(b.lastActivity) : b.lastActivity.localeCompare(a.lastActivity));
}

export async function getClient(clientId: string): Promise<ClientDetail> {
  if (isDesktopRuntime()) return invoke<ClientDetail>("get_client", { clientId });
  const client = loadPreviewClients().find((item) => item.id === clientId);
  if (!client) throw new Error("Client not found");
  return structuredClone(client);
}

export async function createClient(input: ClientInput): Promise<string> {
  if (isDesktopRuntime()) return invoke<string>("create_client", { input });
  const id = globalThis.crypto?.randomUUID?.() ?? `client-${Date.now()}`;
  const clients = loadPreviewClients();
  clients.unshift(inputToDetail(id, input));
  savePreviewClients(clients);
  return id;
}

export async function updateClient(clientId: string, input: ClientInput): Promise<void> {
  if (isDesktopRuntime()) return invoke<void>("update_client", { clientId, input });
  const clients = loadPreviewClients();
  const index = clients.findIndex((item) => item.id === clientId);
  if (index < 0) throw new Error("Client not found");
  clients[index] = inputToDetail(clientId, input, clients[index]);
  savePreviewClients(clients);
}

export async function archiveClient(clientId: string): Promise<void> {
  if (isDesktopRuntime()) return invoke<void>("archive_client", { clientId });
  const clients = loadPreviewClients(); const client = clients.find((item) => item.id === clientId); if (!client) throw new Error("Client not found"); client.status = "archived"; client.archivedAt = new Date().toISOString(); client.updatedAt = client.archivedAt; savePreviewClients(clients);
}

export async function restoreClient(clientId: string): Promise<void> {
  if (isDesktopRuntime()) return invoke<void>("restore_client", { clientId });
  const clients = loadPreviewClients(); const client = clients.find((item) => item.id === clientId); if (!client) throw new Error("Client not found"); client.status = "active"; client.archivedAt = undefined; client.updatedAt = new Date().toISOString(); savePreviewClients(clients);
}

export async function deleteClient(clientId: string): Promise<void> {
  if (isDesktopRuntime()) return invoke<void>("delete_client", { clientId });
  savePreviewClients(loadPreviewClients().filter((item) => item.id !== clientId));
}

export async function uploadClientLogo(clientId: string, file: File): Promise<string> {
  if (isDesktopRuntime()) {
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    return invoke<string>("upload_client_logo", { upload: { clientId, fileName: file.name, mimeType: file.type, bytes } });
  }
  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
  const clients = loadPreviewClients(); const client = clients.find((item) => item.id === clientId); if (!client) throw new Error("Client not found"); client.logoPath = dataUrl; client.updatedAt = new Date().toISOString(); savePreviewClients(clients); return dataUrl;
}

export const platformLabels: Record<PlatformKey, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube" };

export type ClientStatus = "active" | "paused" | "archived";
export type PlatformKey = "instagram" | "facebook" | "linkedin" | "youtube";

export interface ClientInput {
  clientName: string;
  companyName: string;
  brandName: string;
  industry: string;
  website: string;
  location: string;
  businessDescription: string;
  products: string[];
  services: string[];
  targetAudience: string;
  marketingGoals: string[];
  competitors: string[];
  postingFrequency: string;
  mainPlatforms: PlatformKey[];
  status: Exclude<ClientStatus, "archived">;
  brandVoice: string;
  brandPersonality: string[];
  brandColours: string[];
  fonts: string[];
  preferredCta: string;
  contentStyle: string;
  keywords: string[];
  topicsToAvoid: string[];
}

export interface ClientSummary {
  id: string;
  clientName: string;
  brandName: string;
  industry: string;
  location: string;
  socialAccountCount: number;
  scheduledPostCount: number;
  status: ClientStatus;
  lastActivity: string;
  logoPath?: string;
  mainPlatforms: PlatformKey[];
}

export interface ClientStats {
  draftPosts: number;
  approvedPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  connectedPlatforms: number;
}

export interface BrandProfileRecord {
  brandVoice: string;
  brandPersonality: string[];
  brandColours: string[];
  fonts: string[];
  primaryAudience: string;
  preferredCta: string;
  contentStyle: string;
  keywords: string[];
  topicsToAvoid: string[];
}

export interface ClientDetail {
  id: string;
  clientName: string;
  companyName: string;
  brandName: string;
  industry: string;
  website: string;
  location: string;
  businessDescription: string;
  products: string[];
  services: string[];
  targetAudience: string;
  marketingGoals: string[];
  competitors: string[];
  postingFrequency: string;
  mainPlatforms: PlatformKey[];
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  logoPath?: string;
  brandProfile: BrandProfileRecord;
  stats: ClientStats;
}

export interface ClientListOptions {
  search?: string;
  filter?: "active" | "paused" | "archived" | "all";
  sort?: "recent" | "name" | "industry" | "oldest";
}

export const emptyClientInput: ClientInput = {
  clientName: "",
  companyName: "",
  brandName: "",
  industry: "",
  website: "",
  location: "",
  businessDescription: "",
  products: [],
  services: [],
  targetAudience: "",
  marketingGoals: [],
  competitors: [],
  postingFrequency: "",
  mainPlatforms: [],
  status: "active",
  brandVoice: "",
  brandPersonality: [],
  brandColours: [],
  fonts: [],
  preferredCta: "",
  contentStyle: "",
  keywords: [],
  topicsToAvoid: [],
};

export function detailToInput(client: ClientDetail): ClientInput {
  return {
    clientName: client.clientName,
    companyName: client.companyName,
    brandName: client.brandName,
    industry: client.industry,
    website: client.website,
    location: client.location,
    businessDescription: client.businessDescription,
    products: client.products,
    services: client.services,
    targetAudience: client.targetAudience,
    marketingGoals: client.marketingGoals,
    competitors: client.competitors,
    postingFrequency: client.postingFrequency,
    mainPlatforms: client.mainPlatforms,
    status: client.status === "paused" ? "paused" : "active",
    brandVoice: client.brandProfile.brandVoice,
    brandPersonality: client.brandProfile.brandPersonality,
    brandColours: client.brandProfile.brandColours,
    fonts: client.brandProfile.fonts,
    preferredCta: client.brandProfile.preferredCta,
    contentStyle: client.brandProfile.contentStyle,
    keywords: client.brandProfile.keywords,
    topicsToAvoid: client.brandProfile.topicsToAvoid,
  };
}


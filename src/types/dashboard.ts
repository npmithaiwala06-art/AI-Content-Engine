export type TrendDirection = "up" | "down" | "neutral";

export interface DashboardSummary {
  clients: number;
  connectedAccounts: number;
  draftPosts: number;
  waitingApproval: number;
  approved: number;
  scheduled: number;
  published: number;
  failed: number;
  scheduledToday: number;
  publishedToday: number;
  monthlyReach: number;
  monthlyEngagement: number;
  todaySchedule: Array<{id:string;client:string;platform:string;title:string;scheduledFor:string;status:string}>;
  recentActivity: Array<{id:string;action:string;summary:string;clientName?:string;createdAt:string}>;
  performance: Array<{day:string;instagram:number;facebook:number;linkedin:number;youtube:number}>;
}

export interface ScheduledPost {
  id: string;
  client: string;
  initials: string;
  platform: "Instagram" | "Facebook" | "LinkedIn" | "YouTube";
  title: string;
  time: string;
  status: "Approved" | "Scheduled" | "Needs Review";
  accent: string;
}

export interface ActivityItem {
  id: string;
  kind: "published" | "approved" | "scheduled" | "client";
  title: string;
  detail: string;
  time: string;
}

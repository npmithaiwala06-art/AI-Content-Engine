import type { ActivityItem, DashboardSummary, ScheduledPost } from "../types/dashboard";

export const demoSummary: DashboardSummary = {
  clients: 8,
  connectedAccounts: 19,
  draftPosts: 24,
  waitingApproval: 7,
  approved: 11,
  scheduled: 18,
  published: 142,
  failed: 2,
  scheduledToday: 3,
  publishedToday: 6,
  monthlyReach: 124800,
  monthlyEngagement: 13240,
  todaySchedule: [],
  recentActivity: [],
  performance: [],
};

export const scheduledPosts: ScheduledPost[] = [
  {
    id: "schedule-1",
    client: "Northstar Studio",
    initials: "NS",
    platform: "Instagram",
    title: "5 signs your brand needs a refresh",
    time: "10:30 AM",
    status: "Scheduled",
    accent: "#8b5cf6",
  },
  {
    id: "schedule-2",
    client: "Luma Coffee Co.",
    initials: "LC",
    platform: "Facebook",
    title: "Meet the roast: Monsoon Malabar",
    time: "1:00 PM",
    status: "Approved",
    accent: "#f59e0b",
  },
  {
    id: "schedule-3",
    client: "Kite & Co.",
    initials: "KC",
    platform: "LinkedIn",
    title: "What we learned from 100 launches",
    time: "4:15 PM",
    status: "Needs Review",
    accent: "#0ea5e9",
  },
];

export const activityItems: ActivityItem[] = [
  {
    id: "activity-1",
    kind: "published",
    title: "Post published",
    detail: "Northstar Studio · Instagram",
    time: "12 min ago",
  },
  {
    id: "activity-2",
    kind: "approved",
    title: "Content approved",
    detail: "Luma Coffee Co. · 3 posts",
    time: "38 min ago",
  },
  {
    id: "activity-3",
    kind: "scheduled",
    title: "Campaign scheduled",
    detail: "Kite & Co. · Product launch",
    time: "2 hr ago",
  },
  {
    id: "activity-4",
    kind: "client",
    title: "Client profile updated",
    detail: "Mira Wellness",
    time: "Yesterday",
  },
];

export const performanceData = [
  { day: "Mon", instagram: 4200, facebook: 2600, linkedin: 1900 },
  { day: "Tue", instagram: 5100, facebook: 3100, linkedin: 2400 },
  { day: "Wed", instagram: 4800, facebook: 2900, linkedin: 3200 },
  { day: "Thu", instagram: 6200, facebook: 3600, linkedin: 2800 },
  { day: "Fri", instagram: 5900, facebook: 4200, linkedin: 3500 },
  { day: "Sat", instagram: 7300, facebook: 3900, linkedin: 2200 },
  { day: "Sun", instagram: 6800, facebook: 4600, linkedin: 2700 },
];

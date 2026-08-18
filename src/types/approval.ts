import type { PlatformKey } from "./client";
export interface ApprovalItem { postId:string;clientId:string;clientName:string;campaignName?:string;title:string;topic:string;contentType:string;proposedPublishAt?:string;timezone:string;platform:PlatformKey;hook:string;caption:string;cta:string;hashtags:string[];creativeIdea:string;mediaPath?:string;submittedAt:string; }

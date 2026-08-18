import type { PlatformKey } from "./client";
export type MediaKind = "image" | "video" | "logo" | "brand_asset" | "creative" | "document";
export interface MediaRecord { id:string; clientId?:string; clientName?:string; campaignId?:string; kind:MediaKind; fileName:string; absolutePath:string; mimeType:string; fileSizeBytes:number; tags:string[]; platforms:PlatformKey[]; createdAt:string; }
export interface MediaUploadInput { clientId?:string; campaignId?:string; kind:MediaKind; fileName:string; mimeType:string; tags:string[]; platforms:PlatformKey[]; bytes:number[]; }

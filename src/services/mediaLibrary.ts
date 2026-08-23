import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "./desktop";
import type { MediaKind, MediaRecord, MediaUploadInput } from "../types/media";

const previewKey="socialflow.preview.media.v1";
const load=():MediaRecord[]=>{try{return JSON.parse(localStorage.getItem(previewKey)??"[]") as MediaRecord[];}catch{return [];}};
const persist=(records:MediaRecord[])=>localStorage.setItem(previewKey,JSON.stringify(records));
export async function listMedia(filters:{clientId?:string;kind?:string;search?:string}={}):Promise<MediaRecord[]>{
  if(isDesktopRuntime())return invoke<MediaRecord[]>("list_media",filters);
  const query=filters.search?.toLowerCase()??"";return load().filter(item=>(!filters.clientId||item.clientId===filters.clientId)&&(!filters.kind||filters.kind==="all"||item.kind===filters.kind)&&(!query||`${item.fileName} ${item.tags.join(" ")}`.toLowerCase().includes(query)));
}
export async function uploadMedia(file:File,fields:{clientId?:string;campaignId?:string;kind:MediaKind;tags:string[];platforms:MediaUploadInput["platforms"]}):Promise<string>{
  const bytes=Array.from(new Uint8Array(await file.arrayBuffer()));
  if(isDesktopRuntime())return invoke<string>("upload_media",{upload:{...fields,fileName:file.name,mimeType:file.type,bytes}});
  const id=crypto.randomUUID();const absolutePath=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
  persist([{id,...fields,fileName:file.name,absolutePath,mimeType:file.type,fileSizeBytes:file.size,createdAt:new Date().toISOString()},...load()]);return id;
}
export async function renameMedia(mediaId:string,fileName:string):Promise<void>{if(isDesktopRuntime())return invoke("rename_media",{mediaId,fileName});persist(load().map(item=>item.id===mediaId?{...item,fileName}:item));}
export async function deleteMedia(mediaId:string):Promise<void>{if(isDesktopRuntime())return invoke("delete_media",{mediaId});persist(load().filter(item=>item.id!==mediaId));}
const attachmentKey=(postId:string,platform:string)=>`socialflow.preview.attachments.${postId}.${platform}`;
export async function listAttachedMediaIds(postId:string,platform:string):Promise<string[]>{if(isDesktopRuntime())return invoke<string[]>("list_attached_media_ids",{postId,platform});return JSON.parse(localStorage.getItem(attachmentKey(postId,platform))??"[]") as string[];}
export async function attachMedia(postId:string,platform:string,mediaId:string):Promise<void>{if(isDesktopRuntime())return invoke("attach_media",{postId,platform,mediaId});const ids=await listAttachedMediaIds(postId,platform);localStorage.setItem(attachmentKey(postId,platform),JSON.stringify([...new Set([...ids,mediaId]) ]));}
export async function detachMedia(postId:string,platform:string,mediaId:string):Promise<void>{if(isDesktopRuntime())return invoke("detach_media",{postId,platform,mediaId});const ids=await listAttachedMediaIds(postId,platform);localStorage.setItem(attachmentKey(postId,platform),JSON.stringify(ids.filter(id=>id!==mediaId)));}
export function mediaUrl(record:MediaRecord):string{return isDesktopRuntime()?convertFileSrc(record.absolutePath):record.absolutePath;}
export function imagePromptForMedia(client:string,purpose:string,platforms:string[],style:string):string{return `Create a professional social-media creative.\n\nBRAND: ${client}\nPURPOSE: ${purpose}\nPLATFORMS: ${platforms.join(", ")||"Instagram, Facebook, Twitter and YouTube"}\nSTYLE: ${style||"Clean, commercial, brand-consistent"}\n\nRequirements:\n- No platform logos or copied proprietary UI\n- Leave safe space for headline text\n- Strong mobile-first focal point\n- Produce one high-quality image without watermarks\n\nReturn the image plus a short description of the composition.`;}

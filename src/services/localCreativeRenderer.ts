import type { CodexCreativeMode } from "./chatgpt";

export interface CreativeScene {
  durationSeconds: number;
  headline: string;
  onScreenText: string;
  visualDirection: string;
}

export interface CreativePackage {
  campaignName: string;
  brandName: string;
  headline: string;
  subheadline: string;
  cta: string;
  palette: string[];
  image?: {
    visualPrompt: string;
    overlayText: string;
    caption: string;
  };
  video?: {
    durationSeconds: number;
    caption: string;
    scenes: CreativeScene[];
  };
}

export interface GeneratedCreativeMedia {
  kind: "image" | "video";
  url: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function number(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "socialflow-creative";
}

function sourceField(source: string, label: string): string {
  const match = source.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

function cleanJson(raw: string): JsonRecord | undefined {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const candidates = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const result = record(parsed);
      if (result) return result;
    } catch {
      // Try the next extract, then use the safe source-brief fallback.
    }
  }
  return undefined;
}

function platformCreative(root: JsonRecord): JsonRecord | undefined {
  const posts = Array.isArray(root.posts) ? root.posts : [];
  const firstPost = record(posts[0]);
  const platforms = record(firstPost?.platforms);
  if (!platforms) return undefined;
  return record(Object.values(platforms)[0]);
}

function defaultScenes(headline: string, subheadline: string, cta: string): CreativeScene[] {
  return [
    { durationSeconds: 2, headline: "STOP SCROLLING", onScreenText: headline, visualDirection: "Open with a bold hook and energetic motion." },
    { durationSeconds: 2.5, headline: "THE PROBLEM", onScreenText: subheadline, visualDirection: "Show the audience's current frustration clearly." },
    { durationSeconds: 2.5, headline: "THE SOLUTION", onScreenText: headline, visualDirection: "Reveal the product as the simple solution." },
    { durationSeconds: 2.5, headline: "WHY IT MATTERS", onScreenText: subheadline, visualDirection: "Demonstrate the practical value and outcome." },
    { durationSeconds: 2.5, headline: cta, onScreenText: "Take the next step today.", visualDirection: "Finish on a clean branded CTA frame." },
  ];
}

export function parseCreativePackage(raw: string, sourceBrief: string): CreativePackage {
  const root = cleanJson(raw) ?? {};
  const image = record(root.image);
  const video = record(root.video);
  const legacy = platformCreative(root);
  const sourceBrand = sourceField(sourceBrief, "Brand") || sourceField(sourceBrief, "Client");
  const sourceGoal = sourceField(sourceBrief, "Goal");
  const sourceTopic = sourceField(sourceBrief, "Topic") || sourceField(sourceBrief, "Business description");
  const sourceCta = sourceField(sourceBrief, "Preferred CTA");
  const headline = text(root.headline, text(legacy?.hook, text(legacy?.title, sourceGoal || "Create more. Repeat less.")));
  const subheadline = text(root.subheadline, text(legacy?.caption, text(legacy?.description, sourceTopic || "Turn one clear brief into campaign-ready social content.")));
  const cta = text(root.cta, text(legacy?.cta, sourceCta || "Learn more"));
  const paletteValues = Array.isArray(root.palette) ? root.palette.filter((value): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) : [];
  const sceneValues = Array.isArray(video?.scenes) ? video.scenes : [];
  const scenes = sceneValues.map((value) => record(value)).filter((value): value is JsonRecord => Boolean(value)).map((scene) => ({
    durationSeconds: Math.max(1, Math.min(4, number(scene.duration_seconds, 2.5))),
    headline: text(scene.headline, headline),
    onScreenText: text(scene.on_screen_text, subheadline),
    visualDirection: text(scene.visual_direction, "Use clean branded motion graphics."),
  })).slice(0, 6);

  return {
    campaignName: text(root.campaign_name, `${sourceBrand || "SocialFlow"} Campaign`),
    brandName: text(root.brand_name, sourceBrand || "SocialFlow OS"),
    headline: headline.slice(0, 100),
    subheadline: subheadline.slice(0, 240),
    cta: cta.slice(0, 60),
    palette: paletteValues.length >= 2 ? paletteValues.slice(0, 5) : ["#160A3A", "#6D4AFF", "#18A98C", "#FFFFFF"],
    image: image === undefined && root.image === null ? undefined : {
      visualPrompt: text(image?.visual_prompt, text(legacy?.image_prompt, text(legacy?.creative_idea, "Premium branded product advertisement."))),
      overlayText: text(image?.overlay_text, headline),
      caption: text(image?.caption, text(legacy?.caption, subheadline)),
    },
    video: video === undefined && root.video === null ? undefined : {
      durationSeconds: Math.max(8, Math.min(15, number(video?.duration_seconds, 12))),
      caption: text(video?.caption, text(legacy?.caption, subheadline)),
      scenes: scenes.length >= 3 ? scenes : defaultScenes(headline, subheadline, cta),
    },
  };
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function lines(context: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const output: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !current) current = next;
    else {
      output.push(current);
      current = word;
      if (output.length === maxLines - 1) break;
    }
  }
  if (current && output.length < maxLines) output.push(current);
  const consumed = output.join(" ").split(" ").length;
  if (consumed < words.length && output.length) output[output.length - 1] = `${output[output.length - 1].replace(/[.…]+$/, "")}…`;
  return output;
}

function drawLines(context: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
  const output = lines(context, value, maxWidth, maxLines);
  output.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + output.length * lineHeight;
}

function drawBackdrop(context: CanvasRenderingContext2D, width: number, height: number, creative: CreativePackage, progress = 0): void {
  const [dark, accent, secondary] = creative.palette;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, dark);
  gradient.addColorStop(.58, accent);
  gradient.addColorStop(1, secondary || dark);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = .16;
  for (let index = 0; index < 8; index += 1) {
    const radius = width * (.08 + (index % 3) * .035);
    const x = ((index * 173 + progress * width * (index % 2 ? 1 : -1)) % (width + radius * 2)) - radius;
    const y = height * (.08 + index * .125);
    context.fillStyle = index % 2 ? "#FFFFFF" : secondary || "#18A98C";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  context.strokeStyle = "rgba(255,255,255,.08)";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += width / 9) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
}

function drawProductCard(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, creative: CreativePackage, progress = 0): void {
  context.save();
  context.shadowColor = "rgba(0,0,0,.35)";
  context.shadowBlur = 45;
  roundedRect(context, x, y, width, height, 30);
  context.fillStyle = "rgba(12,10,34,.88)";
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "rgba(255,255,255,.22)";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = creative.palette[2] || "#18A98C";
  roundedRect(context, x + 30, y + 30, 68, 68, 18); context.fill();
  context.fillStyle = "#FFFFFF";
  context.font = "700 40px Manrope, Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("✦", x + 64, y + 78);
  context.textAlign = "left";
  context.font = "700 25px Manrope, Arial, sans-serif";
  context.fillText("Generate Content", x + 120, y + 62);
  context.fillStyle = "rgba(255,255,255,.55)";
  context.font = "500 16px Manrope, Arial, sans-serif";
  context.fillText("Brand Memory → campaign-ready creative", x + 120, y + 88);
  const labels = ["HOOK", "VISUAL", "CAPTION", "CTA"];
  const rowGap = Math.max(34, (height - 145) / labels.length);
  const rowHeight = Math.min(43, rowGap - 8);
  labels.forEach((label, index) => {
    const rowY = y + 122 + index * rowGap;
    context.fillStyle = "rgba(255,255,255,.08)";
    roundedRect(context, x + 30, rowY, width - 60, rowHeight, 12); context.fill();
    context.fillStyle = index <= Math.floor(progress * labels.length) ? creative.palette[2] || "#18A98C" : "rgba(255,255,255,.28)";
    roundedRect(context, x + 44, rowY + (rowHeight - 17) / 2, 62, 17, 8); context.fill();
    context.fillStyle = "rgba(255,255,255,.76)";
    context.font = "700 14px Manrope, Arial, sans-serif";
    context.fillText(label, x + 120, rowY + rowHeight / 2 + 5);
  });
  context.restore();
}

function canvasBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("SocialFlow could not encode the generated image.")), mimeType, quality));
}

async function renderImage(creative: CreativePackage): Promise<GeneratedCreativeMedia> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image rendering is unavailable in this app window.");
  drawBackdrop(context, canvas.width, canvas.height, creative);
  context.fillStyle = "rgba(7,5,24,.34)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,255,255,.82)";
  context.font = "700 26px Manrope, Arial, sans-serif";
  context.fillText(creative.brandName.toUpperCase(), 84, 92);
  context.fillStyle = creative.palette[2] || "#18A98C";
  roundedRect(context, 84, 130, 276, 44, 22); context.fill();
  context.fillStyle = "#FFFFFF";
  context.font = "700 18px Manrope, Arial, sans-serif";
  context.fillText("AI-POWERED CAMPAIGN", 112, 159);
  context.font = "800 78px Manrope, Arial, sans-serif";
  context.fillStyle = "#FFFFFF";
  let nextY = drawLines(context, creative.headline, 84, 275, 900, 84, 3);
  context.font = "500 34px Manrope, Arial, sans-serif";
  context.fillStyle = "rgba(255,255,255,.82)";
  nextY = drawLines(context, creative.subheadline, 84, nextY + 18, 870, 48, 3);
  drawProductCard(context, 84, Math.max(590, nextY + 45), 912, 360, creative, 1);
  context.fillStyle = "#FFFFFF";
  roundedRect(context, 84, 1164, 620, 92, 28); context.fill();
  context.fillStyle = creative.palette[0];
  context.font = "800 31px Manrope, Arial, sans-serif";
  context.fillText(creative.cta, 126, 1222);
  context.fillStyle = "rgba(255,255,255,.65)";
  context.font = "600 18px Manrope, Arial, sans-serif";
  context.fillText("CREATED WITH SOCIALFLOW OS", 84, 1306);
  const blob = await canvasBlob(canvas, "image/png");
  return { kind: "image", blob, mimeType: "image/png", url: URL.createObjectURL(blob), fileName: `${safeFileName(creative.campaignName)}-image.png` };
}

function drawVideoFrame(context: CanvasRenderingContext2D, creative: CreativePackage, elapsed: number, duration: number): void {
  const video = creative.video ?? { durationSeconds: duration, caption: creative.subheadline, scenes: defaultScenes(creative.headline, creative.subheadline, creative.cta) };
  const totalWeight = video.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const weightedTime = Math.min(totalWeight - .001, (elapsed / duration) * totalWeight);
  let cursor = 0;
  let sceneIndex = 0;
  for (let index = 0; index < video.scenes.length; index += 1) {
    if (weightedTime < cursor + video.scenes[index].durationSeconds) { sceneIndex = index; break; }
    cursor += video.scenes[index].durationSeconds;
  }
  const scene = video.scenes[sceneIndex];
  const sceneProgress = Math.min(1, Math.max(0, (weightedTime - cursor) / scene.durationSeconds));
  drawBackdrop(context, 540, 960, creative, elapsed / duration);
  context.fillStyle = "rgba(6,4,22,.26)";
  context.fillRect(0, 0, 540, 960);
  context.fillStyle = "rgba(255,255,255,.78)";
  context.font = "700 16px Manrope, Arial, sans-serif";
  context.fillText(creative.brandName.toUpperCase(), 34, 46);
  context.fillStyle = "rgba(255,255,255,.16)";
  roundedRect(context, 34, 70, 472, 5, 3); context.fill();
  context.fillStyle = creative.palette[2] || "#18A98C";
  roundedRect(context, 34, 70, 472 * Math.min(1, elapsed / duration), 5, 3); context.fill();
  context.save();
  context.translate(0, (1 - Math.min(1, sceneProgress * 4)) * 36);
  context.globalAlpha = Math.min(1, sceneProgress * 4) * Math.min(1, (1 - sceneProgress) * 5);
  context.fillStyle = creative.palette[2] || "#18A98C";
  roundedRect(context, 34, 128, 105, 38, 19); context.fill();
  context.fillStyle = "#FFFFFF";
  context.font = "800 14px Manrope, Arial, sans-serif";
  context.fillText(`SCENE ${sceneIndex + 1}`, 52, 153);
  context.font = "800 48px Manrope, Arial, sans-serif";
  let nextY = drawLines(context, scene.onScreenText || scene.headline, 34, 240, 472, 56, 4);
  context.font = "500 20px Manrope, Arial, sans-serif";
  context.fillStyle = "rgba(255,255,255,.72)";
  nextY = drawLines(context, scene.visualDirection, 34, nextY + 20, 460, 29, 3);
  drawProductCard(context, 34, Math.min(540, Math.max(485, nextY + 24)), 472, 290, creative, sceneProgress);
  context.restore();
  if (sceneIndex === video.scenes.length - 1 && sceneProgress > .45) {
    context.fillStyle = "#FFFFFF";
    roundedRect(context, 76, 858, 388, 60, 20); context.fill();
    context.fillStyle = creative.palette[0];
    context.font = "800 21px Manrope, Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(creative.cta, 270, 896);
    context.textAlign = "left";
  }
}

async function renderVideo(creative: CreativePackage, onProgress?: (message: string) => void): Promise<GeneratedCreativeMedia> {
  const canvas = document.createElement("canvas");
  canvas.width = 540;
  canvas.height = 960;
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
    throw new Error("Playable video rendering is not supported by this system WebView. Image creation remains available.");
  }
  const candidates = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 3_500_000 });
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.addEventListener("stop", () => resolve(), { once: true });
    recorder.addEventListener("error", () => reject(new Error("The local video encoder stopped unexpectedly.")), { once: true });
  });
  const duration = Math.max(8, Math.min(15, creative.video?.durationSeconds ?? 12));
  const startedAt = performance.now();
  drawVideoFrame(context, creative, 0, duration);
  recorder.start(500);
  onProgress?.(`Rendering a ${duration}-second vertical motion video locally…`);
  await new Promise<void>((resolve) => {
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      drawVideoFrame(context, creative, Math.min(duration, elapsed), duration);
      if (elapsed >= duration) { window.clearInterval(timer); resolve(); }
    }, 1000 / 30);
  });
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  const recordedType = recorder.mimeType || mimeType || "video/webm";
  // WebKit may report an MP4 codec parameter that it later refuses to load
  // from a Blob URL. Keep the encoded container but normalize the Blob MIME.
  const finalType = recordedType.toLowerCase().includes("mp4") ? "video/mp4" : recordedType.split(";")[0];
  const blob = new Blob(chunks, { type: finalType });
  if (!blob.size) throw new Error("The local video encoder produced an empty file. Please create the video again.");
  const extension = finalType.includes("mp4") ? "mp4" : "webm";
  return { kind: "video", blob, mimeType: finalType, url: URL.createObjectURL(blob), fileName: `${safeFileName(creative.campaignName)}-video.${extension}` };
}

export async function renderCreativeMedia(creative: CreativePackage, mode: CodexCreativeMode, onProgress?: (message: string) => void): Promise<GeneratedCreativeMedia[]> {
  const output: GeneratedCreativeMedia[] = [];
  if (mode === "image" || mode === "both") {
    onProgress?.("Rendering the advertisement image locally…");
    output.push(await renderImage(creative));
  }
  if (mode === "video" || mode === "both") output.push(await renderVideo(creative, onProgress));
  return output;
}

export function releaseGeneratedMedia(media: GeneratedCreativeMedia[]): void {
  media.forEach((item) => URL.revokeObjectURL(item.url));
}

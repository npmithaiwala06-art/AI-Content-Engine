#!/usr/bin/env python3
"""Render the editable SocialFlow OS step-by-step tutorial.

Edit timeline.json, narration.txt, screenshots, or the palette below, then run:
  /tmp/socialflow-video-venv/bin/python render_video.py
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
BUILD = ROOT / "build"
SLIDES = BUILD / "slides"
CLIPS = BUILD / "clips"
FINAL = ROOT / "SocialFlow-OS-Step-by-Step-Demo.mp4"
SRT = ROOT / "SocialFlow-OS-Step-by-Step-Demo.srt"

BG = "#0D1021"
BG_2 = "#171A33"
PANEL = "#202541"
WHITE = "#F7F8FF"
MUTED = "#B7BDD6"
PURPLE = "#7957FF"
CYAN = "#45D5E8"
GREEN = "#4ED6A5"
BORDER = "#343A61"
FONT_REGULAR = "/System/Library/Fonts/SFNS.ttf"
FONT_ROUNDED = "/System/Library/Fonts/SFNSRounded.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_ROUNDED if bold else FONT_REGULAR, size)


def wrap(draw: ImageDraw.ImageDraw, text: str, selected_font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=selected_font)[2] <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def gradient_background(size: tuple[int, int]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size, BG)
    pixels = image.load()
    start = tuple(int(BG[index : index + 2], 16) for index in (1, 3, 5))
    end = tuple(int(BG_2[index : index + 2], 16) for index in (1, 3, 5))
    for y in range(height):
        ratio = y / max(height - 1, 1)
        color = tuple(round(start[i] * (1 - ratio) + end[i] * ratio) for i in range(3))
        for x in range(width):
            pixels[x, y] = color
    return image


def rounded_panel(base: Image.Image, box: tuple[int, int, int, int], radius: int = 30) -> ImageDraw.ImageDraw:
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shifted = (box[0] + 10, box[1] + 14, box[2] + 10, box[3] + 14)
    shadow_draw.rounded_rectangle(shifted, radius=radius, fill=(0, 0, 0, 120))
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle(box, radius=radius, fill=PANEL, outline=BORDER, width=2)
    return draw


def draw_brand(draw: ImageDraw.ImageDraw) -> None:
    draw.rounded_rectangle((74, 52, 126, 104), radius=15, fill=PURPLE)
    draw.line((90, 91, 105, 67), fill=WHITE, width=5)
    draw.line((102, 91, 117, 67), fill=WHITE, width=5)
    draw.text((145, 57), "SocialFlow", font=font(34, True), fill=WHITE)
    draw.text((147, 94), "LOCAL OS", font=font(15, True), fill=MUTED)


def render_slide(scene: dict, index: int, total: int, resolution: tuple[int, int]) -> Path:
    image = gradient_background(resolution).convert("RGBA")
    draw = ImageDraw.Draw(image)
    draw_brand(draw)

    progress_left, progress_right = 74, resolution[0] - 74
    progress_width = int((progress_right - progress_left) * (index + 1) / total)
    draw.rounded_rectangle((progress_left, 1028, progress_right, 1038), radius=5, fill="#2B3054")
    draw.rounded_rectangle((progress_left, 1028, progress_left + progress_width, 1038), radius=5, fill=PURPLE)

    draw.rounded_rectangle((74, 145, 260, 193), radius=24, fill=PURPLE)
    step_text = scene["step"]
    step_box = draw.textbbox((0, 0), step_text, font=font(20, True))
    step_width = step_box[2] - step_box[0]
    draw.text((167 - step_width / 2, 158), step_text, font=font(20, True), fill=WHITE)

    screenshot = scene.get("screenshot")
    if screenshot:
        heading_font = font(52, True)
        heading_lines = wrap(draw, scene["heading"], heading_font, 470)
        y = 235
        for line in heading_lines:
            draw.text((74, y), line, font=heading_font, fill=WHITE)
            y += 62
        caption_font = font(27)
        for line in wrap(draw, scene["caption"], caption_font, 465):
            draw.text((74, y + 18), line, font=caption_font, fill=MUTED)
            y += 39

        bullet_y = max(y + 70, 530)
        for bullet in scene["bullets"]:
            draw.ellipse((80, bullet_y + 8, 96, bullet_y + 24), fill=CYAN)
            lines = wrap(draw, bullet, font(27, True), 430)
            for line_index, line in enumerate(lines):
                draw.text((116, bullet_y + line_index * 35), line, font=font(27, True), fill=WHITE)
            bullet_y += max(64, len(lines) * 35 + 22)

        box = (565, 192, 1846, 994)
        rounded_panel(image, box, 26)
        screen = Image.open(ROOT / screenshot).convert("RGB")
        screen.thumbnail((1235, 756), Image.Resampling.LANCZOS)
        screen_x = box[0] + (box[2] - box[0] - screen.width) // 2
        screen_y = box[1] + (box[3] - box[1] - screen.height) // 2
        mask = Image.new("L", screen.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, screen.width, screen.height), radius=18, fill=255)
        image.paste(screen, (screen_x, screen_y), mask)
    else:
        center_x = resolution[0] // 2
        heading_font = font(76, True)
        heading_lines = wrap(draw, scene["heading"], heading_font, 1500)
        total_height = len(heading_lines) * 88
        y = 300 - total_height // 2
        for line in heading_lines:
            box = draw.textbbox((0, 0), line, font=heading_font)
            draw.text((center_x - (box[2] - box[0]) / 2, y), line, font=heading_font, fill=WHITE)
            y += 88
        caption_font = font(36)
        caption_lines = wrap(draw, scene["caption"], caption_font, 1450)
        y += 35
        for line in caption_lines:
            box = draw.textbbox((0, 0), line, font=caption_font)
            draw.text((center_x - (box[2] - box[0]) / 2, y), line, font=caption_font, fill=MUTED)
            y += 51

        bullets = scene["bullets"]
        total_bullet_width = min(1640, max(620, len(bullets) * 230))
        start_x = center_x - total_bullet_width // 2
        card_width = total_bullet_width // len(bullets) - 14
        card_y = 660
        for bullet_index, bullet in enumerate(bullets):
            x = start_x + bullet_index * (card_width + 14)
            draw.rounded_rectangle((x, card_y, x + card_width, card_y + 128), radius=24, fill=PANEL, outline=BORDER, width=2)
            accent = [PURPLE, CYAN, GREEN][bullet_index % 3]
            draw.rounded_rectangle((x + 20, card_y + 18, x + 28, card_y + 110), radius=4, fill=accent)
            lines = wrap(draw, bullet, font(24, True), card_width - 72)
            text_y = card_y + 36
            for line in lines[:2]:
                draw.text((x + 48, text_y), line, font=font(24, True), fill=WHITE)
                text_y += 31

    draw.text((resolution[0] - 225, 70), f"{index + 1:02d} / {total:02d}", font=font(21, True), fill=MUTED)
    path = SLIDES / f"scene-{index + 1:02d}.png"
    image.convert("RGB").save(path, quality=95)
    return path


def audio_duration(ffmpeg: str, audio: Path) -> float:
    result = subprocess.run([ffmpeg, "-i", str(audio)], capture_output=True, text=True)
    match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", result.stderr)
    if not match:
        raise RuntimeError("Could not determine narration duration")
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def srt_time(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def main() -> None:
    BUILD.mkdir(exist_ok=True)
    SLIDES.mkdir(exist_ok=True)
    CLIPS.mkdir(exist_ok=True)
    config = json.loads((ROOT / "timeline.json").read_text())
    scenes = config["scenes"]
    resolution = tuple(config["resolution"])
    fps = int(config["fps"])
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    audio = ROOT / config["audio"]
    duration = audio_duration(ffmpeg, audio)
    weight_total = sum(float(scene["durationWeight"]) for scene in scenes)
    durations = [duration * float(scene["durationWeight"]) / weight_total for scene in scenes]

    srt_blocks: list[str] = []
    elapsed = 0.0
    clip_paths: list[Path] = []
    for index, (scene, scene_duration) in enumerate(zip(scenes, durations)):
        slide = render_slide(scene, index, len(scenes), resolution)
        clip = CLIPS / f"scene-{index + 1:02d}.mp4"
        fade_out = max(scene_duration - 0.6, 0)
        video_filter = (
            f"zoompan=z='min(zoom+0.00008,1.018)':"
            f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:"
            f"s={resolution[0]}x{resolution[1]}:fps={fps},"
            f"fade=t=in:st=0:d=0.35,fade=t=out:st={fade_out:.3f}:d=0.6,format=yuv420p"
        )
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-loop",
                "1",
                "-i",
                str(slide),
                "-vf",
                video_filter,
                "-t",
                f"{scene_duration:.3f}",
                "-r",
                str(fps),
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "19",
                "-an",
                str(clip),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        clip_paths.append(clip)
        srt_blocks.append(
            f"{index + 1}\n{srt_time(elapsed)} --> {srt_time(elapsed + scene_duration)}\n"
            f"{scene['heading']}\n{scene['caption']}\n"
        )
        elapsed += scene_duration

    concat = BUILD / "concat.txt"
    concat.write_text("".join(f"file '{path.as_posix()}'\n" for path in clip_paths))
    silent_video = BUILD / "silent-video.mp4"
    subprocess.run(
        [ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(silent_video)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(silent_video),
            "-i",
            str(audio),
            "-c:v",
            "copy",
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-shortest",
            "-movflags",
            "+faststart",
            str(FINAL),
        ],
        check=True,
    )
    SRT.write_text("\n".join(srt_blocks))
    print(FINAL)


if __name__ == "__main__":
    main()

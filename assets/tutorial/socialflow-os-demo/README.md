# Editing the SocialFlow OS Tutorial Video

## Simple edits

1. Open `narration.txt` and edit the spoken script.
2. Regenerate `voiceover.mp3` at normal 1× speed.
3. Open `timeline.json` to change headings, captions, bullets, scene order, or screenshot assignments.
4. Replace any PNG in `screenshots/` with another 1600 × 1000 screenshot using the same filename.
5. Render again:

```bash
/tmp/socialflow-video-venv/bin/python render_video.py
```

## Main files

- `plan.md` — story and visual direction
- `narration.txt` — editable voice script
- `timeline.json` — editable scene content and relative timing
- `render_video.py` — editable layout, colors, typography and rendering logic
- `voiceover.mp3` — normal-speed narration
- `SocialFlow-OS-Step-by-Step-Demo.srt` — editable chapter captions
- `SocialFlow-OS-Step-by-Step-Demo.mp4` — final video

## Timing

Each scene has a `durationWeight`. The renderer automatically scales those weights to the exact narration length. Increase a scene’s weight to keep it on screen longer; reduce it to shorten that scene.

## Important publishing note

The video explains the approved workflow but does not claim that real Instagram, YouTube, Facebook, or X publishing has been tested. Update that wording only after official owner configuration and controlled live-provider verification are complete.

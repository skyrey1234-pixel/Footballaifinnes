# Real Film Analysis (vision pipeline)

The default scouting report was previously generated from the opponent's *name*
only — it never looked at the uploaded footage. `server/videoAnalysis.ts` changes
that: it downloads the real video, extracts evenly-spaced frames with ffmpeg, and
sends them to a vision-capable model so the report + "key moments" are grounded in
what's actually on the film.

## What it needs to be enabled

1. **ffmpeg** on PATH (or set `FFMPEG_PATH`).
   - Already present at `/Users/skytrinidad/bin/ffmpeg`; `pnpm run dev` inherits PATH.
2. **A vision-capable model** on the forge LLM endpoint.
   - Set `VISION_MODEL` to a model that accepts `image_url` content
     (e.g. `gpt-4o`, `gemini-2.0-flash`, `claude-3-5-sonnet`, etc.).
   - If unset, it falls back to the endpoint default — verify that default can see images.
3. **YouTube support (optional):** set `YOUTUBE_ENABLED` only if `yt-dlp` is installed.
   - `pip install yt-dlp` (or `brew install yt-dlp`). Without it, YouTube sessions
     fall back to the name-only report with a clear log warning. Uploaded files need
     no extra tooling.

## Tunable env vars (all optional)

| Var | Default | Purpose |
|-----|---------|---------|
| `FFMPEG_PATH` | `ffmpeg` | Path to the ffmpeg binary |
| `VISION_MODEL` | (endpoint default) | Model used for frame analysis |
| `ANALYSIS_FRAME_COUNT` | `10` | How many frames to sample across the game |
| `ANALYSIS_FRAME_WIDTH` | `640` | Frame width (px); keep modest to limit token cost |

## Behavior / safety

- If the video can't be fetched, vision fails, or the model errors, the pipeline
  **falls back** to the previous name-only report (logged as a warning). The app
  still works; it just won't have grounded footage analysis.
- When vision succeeds, the report's `highlights` use the **real** frame timestamps
  (so the "key moments" sidebar points at plays that exist in the film), and the
  report text is instructed to use only observed facts.
- Temp files (downloaded video + frames) are written to the OS temp dir and removed
  in a `finally` block after analysis.

## Cost note

Each analysis sends `ANALYSIS_FRAME_COUNT` frames to the vision model. At the default
10 frames and 640px width with `detail: "low"`, this is a few dozen KB of image data
per report — roughly comparable to a few thousand tokens. Adjust `ANALYSIS_FRAME_COUNT`
if cost per report matters.

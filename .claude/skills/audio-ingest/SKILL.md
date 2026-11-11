---
name: audio-ingest
description: Use when implementing or changing how the worker gets audio from a YouTube video — duration check (≤ 6 min), yt-dlp audio-only download, and Demucs vocal separation (worker/src/song_worker/pipeline.py fetch_audio / separate_vocals).
---

# audio-ingest

## Rules
- **Duration gate first, download second.** Read metadata (`yt-dlp --dump-json --skip-download` or YouTube Data API `contentDetails.duration`). If `duration > 360` s, fail the job with `error = "too_long"` and download nothing. The web `/api/jobs` checks too, but the worker re-checks — never trust the queue.
- Reject live streams (`is_live` / `live_status != "not_live"`) and age-gated/private videos with a clear error code.
- **Audio only**: `-f bestaudio -x --audio-format wav --postprocessor-args "-ar 44100 -ac 2"`. Never download video streams.
- Everything goes in `job.workdir` = `worker/data/<job_id>/` (git-ignored). Delete the raw audio after the stems are produced; keep only `vocals.wav` until the job finishes, then delete it too.
- Never upload original audio/video to Supabase or anywhere public.

## Demucs
- Model `htdemucs`, `--two-stems=vocals`. Output: `vocals.wav`, `no_vocals.wav`.
- CPU is slow (~1–2× realtime on a laptop); log progress to `jobs.progress` (0–30 % for this stage).
- Resample vocals to 16 kHz mono for WhisperX: `ffmpeg -i vocals.wav -ar 16000 -ac 1 vocals16k.wav`.

## Error codes (write to jobs.error)
`too_long`, `live_stream`, `unavailable`, `download_failed`, `separation_failed`.

## Testing
Unit-test the duration gate and error mapping with fake metadata dicts; do not hit YouTube in CI.

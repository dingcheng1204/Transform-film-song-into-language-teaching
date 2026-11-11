# song-worker

Turns a queued YouTube song into a timeline: audio → vocals (Demucs) → word timings (WhisperX) → 1–2-line segments → Supabase.
Runs on your own machine. Defaults are tuned for **CPU only (no NVIDIA GPU), Ubuntu**.

## Setup (Ubuntu, CPU)

```bash
sudo apt update && sudo apt install -y ffmpeg
curl -LsSf https://astral.sh/uv/install.sh | sh     # if uv is not installed

cd worker
uv sync --extra pipeline        # CPU-only torch from the PyTorch CPU index (~1.5 GB download)
cp .env.example .env            # then fill in the values below
```

`worker/.env`:

```
SUPABASE_URL=https://yzqirjnhldwqjjakxeko.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase Dashboard → Project Settings → API Keys → service_role / secret>
WHISPER_MODEL=medium            # "small" is ~3–4× faster on CPU, less accurate
```

The service-role key stays in this file only — never commit it, never put it in Vercel.

## Run

```bash
# Try one song locally first (no Supabase needed) — writes <id>.<lang>.timeline.json
uv run song-worker local "https://www.youtube.com/watch?v=XXXXXXXXXXX" --lang ja
uv run song-worker validate XXXXXXXXXXX.ja.timeline.json

# Then process jobs submitted from the website
uv run song-worker run            # polls every 5 s, Ctrl+C to stop
uv run song-worker run --once     # process at most one job
```

First run downloads models into `~/.cache` (Whisper medium ≈ 1.5 GB, alignment model per language ≈ 1.2 GB, htdemucs ≈ 80 MB).

## Expected speed on CPU (4-minute song, 8-core laptop)

| Stage | Time |
|---|---|
| Download audio | < 30 s |
| Demucs (htdemucs) | 3–6 min |
| WhisperX medium int8 + alignment | 3–8 min (small: 1–2 min) |

## Tests

```bash
uv run pytest        # no ML models needed; heavy stages are injected as fakes
```

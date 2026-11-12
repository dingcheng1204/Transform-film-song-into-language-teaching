# Transform-film-song-into-language-teaching

Turn a YouTube song (≤ 6 min) into a line-by-line pronunciation & singing lesson:
play 1–2 lines → auto-pause → show reading, bilingual subtitles (中英 / 中日 / 中韓), and tips → continue.

Supported song languages: **Japanese, English, Korean** (`sourceLang`: `ja` / `en` / `ko`).

The original video is **embedded** with the YouTube IFrame Player API — it is never re-rendered or re-hosted.

## Layout

```
web/         React + Vite + TS + Tailwind  → Vercel (Root Directory: web)
web/api/     Vercel Functions (light work only: validate URL/duration, enqueue job)
worker/      Python pipeline (yt-dlp → Demucs → WhisperX → Claude → TTS) — runs locally first
schema/      timeline.schema.json — single source of truth for the data format
supabase/    migrations (only touch the song_teaching schema)
.claude/skills/  project skills used when building with Claude Code
```

## Data flow

```
web /lesson/:id ──POST /api/jobs──▶ song_teaching.enqueue_job()  → jobs (pending)
                                                                    │ claim_job() every 5 s
                                                worker (your machine, CPU) ◀┘
                                                yt-dlp → Demucs → WhisperX → segments
web ◀──GET /api/lesson (polls 3 s)── timelines (jsonb, one per video+language) ◀┘
```

Tables (`supabase/migrations/`): `song_teaching.jobs` (queue + progress) and `song_teaching.timelines`
(the Timeline JSON, validated against the schema before it is written). The web uses the publishable
key through Vercel Functions; only the worker holds the service-role key. See `worker/README.md` to run it.

## Schema → types

`schema/timeline.schema.json` generates:

- `web/src/types/timeline.ts` — `pnpm --dir web gen:types`
- `worker/src/song_worker/timeline.py` — `cd worker && uv run gen-models`

Never edit generated files by hand.

## Phases

| Tag | Content |
|---|---|
| `p0-scaffold` | Monorepo, schema, project skills, CI, Vercel shell |
| `p1-player` | URL input + ≤6 min check, embedded player, pause/lesson card from sample timeline |
| `p2-align` | Worker: audio → vocals → word timestamps → Supabase |
| `p3-lessons` | Translation, furigana/romaji (ja), pronounced Hangul + RR (ko), IPA (en), LLM-generated lessons (MiniMax, OpenAI-compatible) |
| `p4-tts` | Slow TTS readings in lesson cards |
| `p5-pitch` | Pitch contour for singing tips |
| `p6-cloud` | (optional) Worker on GPU host, mp4 export |

## Supabase

Shares the `flight-price-notifier` project (free plan has 2 active projects).
Everything lives in the `song_teaching` schema and the `song-tts` storage bucket; RLS on every table.
After the first migration, `song_teaching` must be listed under Dashboard → Project Settings → Data API → Exposed schemas.
The service-role key exists only in `worker/.env`, never in `web/` or Vercel.

## Copyright note

Lyrics transcriptions/translations are derivative works. Keep processed lessons private to the
uploader, or demo with royalty-free / CC-licensed songs.

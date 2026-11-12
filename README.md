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

## Goal

Not just singing: learn Japanese / English / Korean naturally *through* songs you like —
understand each line, hear and repeat each word, pick up reusable vocabulary and grammar, then sing it.

## Phases

| Tag | Content |
|---|---|
| `p0-scaffold` | Monorepo, schema, project skills, CI, Vercel shell |
| `p1-player` | URL input + ≤6 min check, embedded player, pause/lesson card from sample timeline |
| `p2-align` | Worker: audio → vocals → word timestamps → Supabase |
| `p3-lessons` | zh-TW translation; readings (ja furigana/romaji, ko pronounced Hangul + RR, en IPA); per-word zh meanings; grammar / pronunciation / connected-speech / singing notes (LLM: MiniMax, OpenAI-compatible); tap a word to hear it + see its meaning; read word by word / slowly (browser speech) |
| `p4-patterns` | Sentence patterns from each line + substitution drills (swap words, hear and say new sentences) |
| `p5-review` | Sign in (email link / Google, Supabase Auth); save words and lines; SM-2 spaced-repetition review page with the original clip; dictation (typed answer aligned word/char-wise, kana accepted for ja); shadowing (record yourself in the browser, compare with the original — never uploaded) |
| `p6-voice` | Server TTS (more natural voices) and pitch contour for singing |
| `p7-cloud` | (optional) Worker heavy stages on a cloud GPU |

## Supabase

Shares the `flight-price-notifier` project (free plan has 2 active projects).
Everything lives in the `song_teaching` schema and the `song-tts` storage bucket; RLS on every table.
After the first migration, `song_teaching` must be listed under Dashboard → Project Settings → Data API → Exposed schemas.
Per-user tables (`saved_items`, `review_logs`) are accessed from the browser with the user's session; RLS limits every row to `auth.uid()`.
Auth users are shared with flight-price-notifier (same project). Add `https://song-teaching.vercel.app/**` to Authentication → URL Configuration → Redirect URLs.
The service-role key exists only in `worker/.env`, never in `web/` or Vercel.

## Copyright note

Lyrics transcriptions/translations are derivative works. Keep processed lessons private to the
uploader, or demo with royalty-free / CC-licensed songs.

# CLAUDE.md

YouTube song (≤ 6 min) → line-by-line pronunciation/singing lesson with zh-TW subtitles. See README.md for layout and phases.

## Hard rules
- `schema/timeline.schema.json` is the contract. After changing it run `uv run gen-models` (in worker/) and `pnpm gen:types` (in web/). Never edit `worker/src/song_worker/timeline.py` or `web/src/types/timeline.ts` by hand.
- The YouTube video is embedded with the IFrame Player API. Never re-host or re-render the original video/audio.
- Heavy processing (yt-dlp, Demucs, WhisperX, TTS) lives in `worker/` — never in Vercel Functions.
- Supabase: only the `song_teaching` schema and `song-tts` bucket of the shared flight-price-notifier project. RLS on every table. Service-role key only in `worker/.env`.
- Each phase ends with green CI and a tag `pN-<name>`.

## Commands
```
cd web    && pnpm dev | pnpm test | pnpm typecheck | pnpm lint | pnpm build
cd worker && uv run pytest | uv run ruff check . | uv run ruff format .
```

## Project skills
`.claude/skills/`: audio-ingest, lyrics-align, bilingual-subs, pronunciation-lesson, tts-gen — read the matching one before touching that stage.

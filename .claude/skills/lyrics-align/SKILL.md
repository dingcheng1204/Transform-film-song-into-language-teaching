---
name: lyrics-align
description: Use when working on word-level timestamps or segmentation — WhisperX transcription/alignment of the vocal stem, grouping words into lines and lines into 1–2-line teaching segments, or any change to schema/timeline.schema.json.
---

# lyrics-align

## The contract
`schema/timeline.schema.json` is the single source of truth. After ANY change to it:
1. `cd worker && uv run gen-models` → regenerates `worker/src/song_worker/timeline.py`
2. `pnpm --dir web gen:types` → regenerates `web/src/types/timeline.ts`
3. Update `schema/examples/*.timeline.json` so both test suites still pass.
Never hand-edit the generated files. CI fails if they are stale.

## WhisperX
- Input: `vocals16k.wav` (from audio-ingest). Pass `language` explicitly (`en` / `ja`) — auto-detect is unreliable on singing.
- Model: `large-v3` on GPU, `medium` on CPU. `compute_type="int8"` on CPU.
- Run `whisperx.align` to get word timings. Words with no alignment (missing `start`) inherit from neighbours by linear interpolation; never drop them.
- Japanese: WhisperX returns characters, not words — merge into words with a tokenizer (fugashi/MeCab via `pykakasi` or `sudachipy`) before segmentation.

## Lines
- Split on Whisper segment boundaries first, then on gaps ≥ 0.6 s between words.
- A line longer than 12 s or ~14 English words / ~25 Japanese chars is split at the largest internal gap.

## Segments (the play-then-pause unit)
- 1–2 lines per segment (schema enforces `maxItems: 2`).
- Merge two lines into one segment when together they are ≤ 8 s; otherwise one line per segment.
- `segment.start` = first word start − 0.15 s (clamp ≥ 0); `segment.end` = last word end + 0.25 s, but never past the next segment's start.
- Segment `id`s are 0-based and contiguous.

## Testing
Pure functions (`segment_lines`) get unit tests with synthetic word lists — no models in CI.

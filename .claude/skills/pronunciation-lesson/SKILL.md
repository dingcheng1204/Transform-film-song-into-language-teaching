---
name: pronunciation-lesson
description: Use when generating or displaying the per-segment teaching content — pronunciationNotes, connectedSpeech, singingTips — including the Claude prompt that writes them and the lesson card UI that shows them during the pause.
---

# pronunciation-lesson

## Goal
Natural language learning through songs: the learner should understand the line, reuse its words and grammar outside the song, pronounce it, and sing it — in that order of importance.

## Audience
Taiwanese learners singing Japanese, English or Korean songs. All explanations in zh-TW. Assume they can read the original script but not that they know IPA — always pair a symbol with a plain hint (「像注音 ㄜ 但更短」).

## Content per segment (schema `Lesson`)
| Field | What goes in | Limit |
|---|---|---|
| `grammarNotes` (optional) | Reusable grammar/usage in this segment: particles, conjugations, set phrases; meaning + how to use it elsewhere | ≤ 2 items |
| `pronunciationNotes` | Hard individual sounds: en th, r/l, final consonants; ja long vowels, っ, ん, devoiced i/u; ko plain/aspirated/tense (ㄱ/ㅋ/ㄲ), ㅓ vs ㅗ, batchim | ≤ 3 items |
| `connectedSpeech` | en linking, flaps, reductions (gonna/wanna); ja vowel merging in fast singing; ko 연음 linking, 경음화 tensing, 비음화 nasalization, 구개음화 palatalization, ㅎ deletion | ≤ 3 items |
| `singingTips` | Held notes, where to breathe, syllables squeezed onto one note, rhythm | ≤ 2 items |

Each item is one short sentence that quotes the exact words from the segment. No generic advice ("多練習").

The same LLM call also returns `wordMeanings`: one array per line, same length/order as its words, each a 2–8 character zh-TW gloss (function words in parentheses, e.g. 「（受詞助詞）」). Stored in `Word.meaning`; arrays that don't line up are dropped.

## Generation (LLM — MiniMax by default; `worker/src/song_worker/annotate.py`)
- One call per **segment**, but include the previous and next line as context.
- Give the model: lines, word timings (so it can spot held notes = long word durations), readings.
- Ask for JSON matching `Lesson` minus `ttsUrl`/`ttsRate`; trim to the limits and validate with the generated Pydantic model. Unparsable output is retried once; a segment that still fails keeps empty arrays (the job does not fail).
- Segments run in parallel (`LLM_CONCURRENCY`, default 4).

## Lesson card UI (web)
- Shown when playback reaches `segment.end` and the player is paused.
- Order: original line with per-word reading above it (ruby for ja/ko, IPA for en) and romanization below → zh-TW translation → word study buttons → 文法與用法 → 發音重點 → 連音與音變 → 唱法提示.
- Word study (browser Web Speech API, `web/src/lib/speech.ts`): tap a word → it is spoken and `WordDetail` shows reading / romanization / meaning; 逐字念給我聽 speaks each word (highlighted) then the whole line; 整句慢慢念 speaks the lines at rate 0.7. Japanese words are spoken from their kana reading so kanji aren't misread. Auto-continue pauses while the learner studies.
- Buttons: 重播這段 (seek to `segment.start`), 繼續 (play next segment), 自動模式 toggle (pause N seconds then continue).
- Keyboard: Space = continue, R = replay.

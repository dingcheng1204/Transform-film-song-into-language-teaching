---
name: bilingual-subs
description: Use when producing translations and reading annotations for subtitles — zh-TW translation of each line, Japanese furigana/romaji, Korean pronounced-Hangul/romanization, English IPA, or exporting WebVTT bilingual subtitles.
---

# bilingual-subs

## Output fields (see schema)
- `Line.translation` — Traditional Chinese (zh-TW, Taiwan usage: 「影片」不是「視頻」, 「軟體」不是「軟件」).
- `Word.reading` — ja: hiragana; ko: Hangul **as pronounced** after sound-change rules (같이 → 가치, 좋아해 → 조아해); en: IPA (General American).
- `Word.romanization` — ja: Hepburn (`し`→`shi`, long vowels as `ou` — stay consistent); ko: Revised Romanization of the *pronounced* form (가치 → gachi); en: omit.

## Translation (LLM — MiniMax by default, OpenAI-compatible; `worker/src/song_worker/llm.py`)
- Translate **the whole song in one call** (all lines, numbered) so pronouns, tense and imagery stay consistent; return JSON `{ "lines": [{ "i": 0, "zh": "..." }] }` and validate the count matches.
- Keep it singable-meaning, not literal word-by-word; keep line breaks 1:1 with the source.
- MiniMax ignores `temperature`; keep prompts explicit instead. Provider/model come from env `LLM_BASE_URL` / `LLM_MODEL`; `reasoning_split: true` keeps thinking out of `content`, and `extract_json` strips any `<think>` block anyway.

## Japanese readings
- `pykakasi` for kana + romaji. Override known song-reading quirks (e.g. 「運命」sung as「さだめ」) only when the singer's audio clearly differs — leave a TODO list, don't guess.
- Katakana loanwords: reading = hiragana conversion, romaji from the katakana.

## Korean readings
- Pronounced form via our own rule engine `ko_pron.py` (연음, ㅎ 탈락, 구개음화, 격음화, 비음화, 유음화, 경음화, 받침 neutralization) — g2pk needs MeCab and downloads data at runtime, so it is not used. Then romanize with `korean-romanizer` (Revised Romanization).
- Lexical exceptions (사잇소리, e.g. 별빛 → 별삗) are not rule-predictable; the LLM lesson covers them. Add a test case for every rule change.
- Lessons should name the rule that changed the sound (연음, 경음화, 비음화, 구개음화, ㅎ 탈락).

## English IPA
- `phonemizer` with `espeak-ng` backend, `en-us`, `with_stress=True`. Strip punctuation before phonemizing; keep the original token in `Word.text`.

## WebVTT export (for download / debugging)
```
00:00:02.000 --> 00:00:04.600
Walk me out into the light
帶我走進光裡
```
Two text lines per cue: original (ja/en/ko), then zh-TW. Generated on the fly from the timeline; not stored.

## Copyright
Lyrics + translations are derivative works. Never put them in public static files, OG tags, or logs.

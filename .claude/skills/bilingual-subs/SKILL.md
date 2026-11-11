---
name: bilingual-subs
description: Use when producing translations and reading annotations for subtitles — zh-TW translation of each line, Japanese furigana/romaji, English IPA, or exporting WebVTT bilingual subtitles.
---

# bilingual-subs

## Output fields (see schema)
- `Line.translation` — Traditional Chinese (zh-TW, Taiwan usage: 「影片」不是「視頻」, 「軟體」不是「軟件」).
- `Word.reading` — ja: hiragana; en: IPA (General American).
- `Word.romaji` — ja only, Hepburn (`し`→`shi`, long vowels as `ou`/`ū` — pick `ou` and stay consistent).

## Translation (Claude API)
- Translate **the whole song in one call** (all lines, numbered) so pronouns, tense and imagery stay consistent; return JSON `{ "lines": [{ "i": 0, "zh": "..." }] }` and validate the count matches.
- Keep it singable-meaning, not literal word-by-word; keep line breaks 1:1 with the source.
- Temperature low (0–0.3). Model id comes from env `ANTHROPIC_MODEL`.

## Japanese readings
- `pykakasi` for kana + romaji. Override known song-reading quirks (e.g. 「運命」sung as「さだめ」) only when the singer's audio clearly differs — leave a TODO list, don't guess.
- Katakana loanwords: reading = hiragana conversion, romaji from the katakana.

## English IPA
- `phonemizer` with `espeak-ng` backend, `en-us`, `with_stress=True`. Strip punctuation before phonemizing; keep the original token in `Word.text`.

## WebVTT export (for download / debugging)
```
00:00:02.000 --> 00:00:04.600
Walk me out into the light
帶我走進光裡
```
Two text lines per cue: original, then zh-TW. Generated on the fly from the timeline; not stored.

## Copyright
Lyrics + translations are derivative works. Never put them in public static files, OG tags, or logs.

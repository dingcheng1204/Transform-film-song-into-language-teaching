---
name: bilingual-subs
description: Use when producing translations and reading annotations for subtitles — zh-TW translation of each line, Japanese furigana/romaji, Korean pronounced-Hangul/romanization, English IPA, or exporting WebVTT bilingual subtitles.
---

# bilingual-subs

## Output fields (see schema)
- `Line.translation` — Traditional Chinese (zh-TW, Taiwan usage: 「影片」不是「視頻」, 「軟體」不是「軟件」).
- `Word.reading` — ja: hiragana; ko: Hangul **as pronounced** after sound-change rules (같이 → 가치, 좋아해 → 조아해); en: IPA (General American).
- `Word.romanization` — ja: Hepburn (`し`→`shi`, long vowels as `ou` — stay consistent); ko: Revised Romanization of the *pronounced* form (가치 → gachi); en: omit.

## Translation (Claude API)
- Translate **the whole song in one call** (all lines, numbered) so pronouns, tense and imagery stay consistent; return JSON `{ "lines": [{ "i": 0, "zh": "..." }] }` and validate the count matches.
- Keep it singable-meaning, not literal word-by-word; keep line breaks 1:1 with the source.
- Temperature low (0–0.3). Model id comes from env `ANTHROPIC_MODEL`.

## Japanese readings
- `pykakasi` for kana + romaji. Override known song-reading quirks (e.g. 「運命」sung as「さだめ」) only when the singer's audio clearly differs — leave a TODO list, don't guess.
- Katakana loanwords: reading = hiragana conversion, romaji from the katakana.

## Korean readings
- Pronounced form via `g2pk` (grapheme-to-phoneme for Korean), then romanize with `korean-romanizer` (Revised Romanization).
- g2pk is rule-based; spot-check common lyric words (사랑해, 같이, 없어, 좋아) in tests.
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

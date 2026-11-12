/* GENERATED from schema/timeline.schema.json by scripts/gen-types.mjs — do not edit. */

/**
 * Single source of truth for a processed song lesson. The worker writes it, the web player reads it. TS types and Pydantic models are generated from this file — never edit them by hand.
 */
export interface Timeline {
  schemaVersion: '1.0'
  song: Song
  /**
   * @minItems 1
   */
  segments: [Segment, ...Segment[]]
}
export interface Song {
  youtubeId: string
  title: string
  artist?: string
  /**
   * Input limit: 6 minutes.
   */
  durationSec: number
  /**
   * Language being sung.
   */
  sourceLang: 'en' | 'ja' | 'ko'
  /**
   * Translation / explanation language.
   */
  targetLang: 'zh-TW'
}
/**
 * One teaching unit: play [start, end) then pause and show the lesson. Holds 1–2 lines.
 */
export interface Segment {
  id: number
  start: number
  end: number
  /**
   * @minItems 1
   * @maxItems 2
   */
  lines: [Line] | [Line, Line]
  lesson: Lesson
}
export interface Line {
  /**
   * Original sung text.
   */
  text: string
  /**
   * zh-TW translation.
   */
  translation: string
  start: number
  end: number
  words: Word[]
}
export interface Word {
  text: string
  start: number
  end: number
  /**
   * ja: hiragana reading (furigana). ko: Hangul as actually pronounced after sound changes (e.g. 같이 → 가치). en: IPA.
   */
  reading?: string
  /**
   * ja: Hepburn romaji. ko: Revised Romanization of the pronounced form. en: omitted.
   */
  romanization?: string
  /**
   * Short zh-TW gloss of this word in context (e.g. 夜空 → 夜空, を → （受詞助詞）). Shown when the learner taps the word.
   */
  meaning?: string
}
export interface Lesson {
  /**
   * zh-TW notes on grammar and usage in this segment (particles, conjugations, set phrases) — what the learner can reuse outside the song.
   */
  grammarNotes?: string[]
  /**
   * zh-TW notes on hard sounds in this segment.
   */
  pronunciationNotes: string[]
  /**
   * Linking, reduction, elision, devoicing, long vowels, etc.
   */
  connectedSpeech: string[]
  /**
   * Rhythm, held notes, breath points.
   */
  singingTips: string[]
  /**
   * Path in Supabase Storage bucket song-tts for the slow reading (P4+).
   */
  ttsUrl?: string
  /**
   * Speaking rate used for the TTS reading.
   */
  ttsRate?: number
  /**
   * Reusable sentence patterns from this segment with substitution examples (P4).
   *
   * @maxItems 2
   */
  patterns?: [] | [Pattern] | [Pattern, Pattern]
}
export interface Pattern {
  /**
   * The pattern with slots, e.g. 「〔名詞〕に光る〔名詞〕」 / "I want to ___" / "〔名詞〕를 좋아해".
   */
  pattern: string
  /**
   * zh-TW: what the pattern means and when to use it.
   */
  explanation: string
  /**
   * @minItems 1
   * @maxItems 4
   */
  examples:
    | [PatternExample]
    | [PatternExample, PatternExample]
    | [PatternExample, PatternExample, PatternExample]
    | [PatternExample, PatternExample, PatternExample, PatternExample]
}
export interface PatternExample {
  /**
   * New sentence in the song's language built from the pattern.
   */
  text: string
  /**
   * zh-TW translation.
   */
  translation: string
  /**
   * What was substituted, e.g. 「星 → 月」.
   */
  swap?: string
  /**
   * ja: whole sentence in hiragana. ko: pronounced Hangul. en: omitted.
   */
  reading?: string
  /**
   * ja: Hepburn. ko: Revised Romanization. en: omitted.
   */
  romanization?: string
}

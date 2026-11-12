// Dictation checking: align what the learner typed with the lyric and mark each unit.
//   en / ko: compare word by word (case and punctuation ignored)
//   ja: compare character by character; kana answers are accepted for kanji
//       (checked against both the lyric and its kana reading, best match wins)
import type { Lang } from './samples'

export interface Mark {
  text: string
  ok: boolean
}

export interface DictationResult {
  /** The expected units, each marked heard (ok) or missed. */
  expected: Mark[]
  /** Fraction of expected units the learner got, 0–1. */
  score: number
  /** Typed units that matched nothing. */
  extra: string[]
}

const PUNCT = /[\s\p{P}\p{S}]+/gu

const toHiragana = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

function units(text: string, lang: Lang): string[] {
  if (lang === 'ja') return [...toHiragana(text.normalize('NFKC')).replace(PUNCT, '')]
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/\s+/)
    .map((w) => w.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ''))
    .filter(Boolean)
}

/** Longest common subsequence alignment; returns which indexes of a and b are matched. */
function lcs(a: string[], b: string[]): { aHit: boolean[]; bHit: boolean[] } {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const aHit = new Array(a.length).fill(false)
  const bHit = new Array(b.length).fill(false)
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      aHit[i] = bHit[j] = true
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return { aHit, bHit }
}

function compare(expectedText: string, typed: string, lang: Lang): DictationResult {
  const exp = units(expectedText, lang)
  const got = units(typed, lang)
  const { aHit, bHit } = lcs(exp, got)
  const hits = aHit.filter(Boolean).length
  return {
    expected: exp.map((t, i) => ({ text: t, ok: aHit[i] })),
    score: exp.length ? hits / exp.length : 0,
    extra: got.filter((_, j) => !bHit[j]),
  }
}

export function checkDictation(
  line: { text: string; reading?: string },
  typed: string,
  lang: Lang,
): DictationResult {
  const byText = compare(line.text, typed, lang)
  if (lang !== 'ja' || !line.reading) return byText
  const byReading = compare(line.reading, typed, lang)
  return byReading.score > byText.score ? byReading : byText
}

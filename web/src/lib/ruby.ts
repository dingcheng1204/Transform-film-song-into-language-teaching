// Split a word and its reading so furigana sits only over the kanji part.
// 光る / ひかる → [光(ひか)] [る]; お茶 / おちゃ → [お] [茶(ちゃ)]
export interface RubyPart {
  base: string
  rt?: string
}

const toHiragana = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

const isKana = (c: string) => /[぀-ゟ゠-ヿ]/.test(c)

export function splitRuby(text: string, reading: string | undefined): RubyPart[] {
  if (!reading || toHiragana(text) === toHiragana(reading)) return [{ base: text }]

  const t = [...text]
  const r = [...reading]
  // Strip shared kana prefix.
  let pre = 0
  while (pre < t.length && pre < r.length && isKana(t[pre]) && toHiragana(t[pre]) === toHiragana(r[pre]))
    pre++
  // Strip shared kana suffix.
  let suf = 0
  while (
    suf < t.length - pre &&
    suf < r.length - pre &&
    isKana(t[t.length - 1 - suf]) &&
    toHiragana(t[t.length - 1 - suf]) === toHiragana(r[r.length - 1 - suf])
  )
    suf++

  const core = t.slice(pre, t.length - suf).join('')
  const coreRt = r.slice(pre, r.length - suf).join('')
  if (!core || !coreRt) return [{ base: text, rt: reading }]

  const parts: RubyPart[] = []
  if (pre) parts.push({ base: t.slice(0, pre).join('') })
  parts.push({ base: core, rt: coreRt })
  if (suf) parts.push({ base: t.slice(t.length - suf).join('') })
  return parts
}

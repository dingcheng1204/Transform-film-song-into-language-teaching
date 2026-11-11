import { splitRuby } from '../lib/ruby'
import type { Line, Song } from '../types/timeline'

interface Props {
  line: Line
  lang: Song['sourceLang']
  /** Index of the word being sung, or -1. */
  activeWord?: number
  size?: 'lg' | 'md'
}

// One lyric line: readings above each word (ruby), romanization under ja/ko, zh-TW translation.
export default function LyricLine({ line, lang, activeWord = -1, size = 'lg' }: Props) {
  const showRomanization = lang !== 'en'
  const textSize = size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-xl'
  return (
    <div className="space-y-1">
      <p className={`${textSize} font-medium leading-[1.9]`} lang={lang}>
        {line.words.map((w, i) => (
          <span key={i} className={i === activeWord ? 'marker' : undefined}>
            {splitRuby(w.text, w.reading).map((p, j) =>
              p.rt ? (
                <ruby key={j}>
                  {p.base}
                  <rt>{p.rt}</rt>
                </ruby>
              ) : (
                <span key={j}>{p.base}</span>
              ),
            )}
            {lang === 'ja' ? '' : ' '}
          </span>
        ))}
      </p>
      {showRomanization && (
        <p className="text-sm tracking-wide text-muted" lang={`${lang}-Latn`}>
          {line.words.map((w) => w.romanization ?? '').join(' ')}
        </p>
      )}
      <p className={size === 'lg' ? 'text-lg text-ink-soft' : 'text-base text-ink-soft'} lang="zh-Hant">
        {line.translation}
      </p>
    </div>
  )
}

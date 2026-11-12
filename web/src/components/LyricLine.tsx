import { splitRuby } from '../lib/ruby'
import type { Line, Song } from '../types/timeline'

interface Props {
  line: Line
  lang: Song['sourceLang']
  /** Index of the word being sung or spoken, or -1. */
  activeWord?: number
  /** Index of the word whose details are open, or -1. */
  selectedWord?: number
  /** When set, words become buttons (lesson mode). */
  onWordClick?: (index: number) => void
  size?: 'lg' | 'md'
}

// One lyric line: readings above each word (ruby), romanization under ja/ko, zh-TW translation.
export default function LyricLine({
  line,
  lang,
  activeWord = -1,
  selectedWord = -1,
  onWordClick,
  size = 'lg',
}: Props) {
  const showRomanization = lang !== 'en' && line.words.some((w) => w.romanization)
  const textSize = size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-xl'
  return (
    <div className="space-y-1">
      <p className={`${textSize} font-medium leading-[1.9]`} lang={lang}>
        {line.words.map((w, i) => {
          const ruby = splitRuby(w.text, w.reading).map((p, j) =>
            p.rt ? (
              <ruby key={j}>
                {p.base}
                <rt>{p.rt}</rt>
              </ruby>
            ) : (
              <span key={j}>{p.base}</span>
            ),
          )
          const cls = [
            i === activeWord ? 'marker' : '',
            onWordClick ? 'cursor-pointer rounded px-0.5 hover:bg-sheet' : '',
            i === selectedWord ? 'underline decoration-2 underline-offset-8' : '',
          ].join(' ')
          return (
            <span key={i}>
              {onWordClick ? (
                <button
                  type="button"
                  onClick={() => onWordClick(i)}
                  className={cls}
                  aria-label={`${w.text}${w.meaning ? `：${w.meaning}` : ''}，點一下朗讀`}
                >
                  {ruby}
                </button>
              ) : (
                <span className={cls}>{ruby}</span>
              )}
              {lang === 'ja' ? '' : ' '}
            </span>
          )
        })}
      </p>
      {showRomanization && (
        <p className="text-sm tracking-wide text-muted" lang={`${lang}-Latn`}>
          {line.words.map((w) => w.romanization ?? '').join(' ')}
        </p>
      )}
      {line.translation && (
        <p className={size === 'lg' ? 'text-lg text-ink-soft' : 'text-base text-ink-soft'} lang="zh-Hant">
          {line.translation}
        </p>
      )}
    </div>
  )
}

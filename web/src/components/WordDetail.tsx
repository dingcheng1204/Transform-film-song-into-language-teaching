import type { Song, Word } from '../types/timeline'

interface Props {
  word: Word
  lang: Song['sourceLang']
  onSpeak: () => void
  onClose: () => void
}

// Details for the tapped word: reading, romanization, meaning, and replay.
export default function WordDetail({ word, lang, onSpeak, onClose }: Props) {
  const reading = word.reading && word.reading !== word.text ? word.reading : null
  return (
    <div
      role="dialog"
      aria-label={`單字：${word.text}`}
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-ink bg-sheet px-4 py-3"
    >
      <span className="text-2xl font-medium" lang={lang}>
        {word.text}
      </span>
      {(reading || word.romanization) && (
        <span className="text-ink-soft">
          {reading && <span lang={lang === 'en' ? undefined : lang}>{lang === 'en' ? `/${reading}/` : reading}</span>}
          {reading && word.romanization && <span className="mx-2 text-rule">|</span>}
          {word.romanization && <span>{word.romanization}</span>}
        </span>
      )}
      <span className="text-lg" lang="zh-Hant">
        {word.meaning ?? <span className="text-muted">（還沒有中文解釋）</span>}
      </span>
      <span className="ml-auto flex gap-2">
        <button type="button" onClick={onSpeak} className="rounded-md border border-ink px-3 py-1 text-sm hover:bg-paper">
          再念一次
        </button>
        <button type="button" onClick={onClose} aria-label="關閉" className="rounded-md px-2 py-1 text-sm text-muted hover:bg-paper">
          ✕
        </button>
      </span>
    </div>
  )
}

import type { ReactNode } from 'react'
import type { Segment, Song } from '../types/timeline'
import PatternDrill from './PatternDrill'

interface Props {
  segment: Segment
  /** While the segment replays: card stays visible, every control disabled. */
  locked?: boolean
  lang: Song['sourceLang']
  onSpeakText: (text: string) => void
  /** One entry per line; undefined = saving unavailable */
  savedLines?: boolean[]
  onToggleSaveLine?: (lineIndex: number) => void
  isLast: boolean
  autoMode: boolean
  countdown: number | null
  speaking: 'words' | 'slow' | null
  canSpeak: boolean
  onReplay: () => void
  onContinue: () => void
  onToggleAuto: () => void
  onSpeakWords: () => void
  onSpeakSlow: () => void
  onStopSpeaking: () => void
  /** Extra practice sections (dictation / shadowing). */
  children?: ReactNode
}

const SECTIONS = [
  { key: 'grammarNotes', title: '文法與用法' },
  { key: 'pronunciationNotes', title: '發音重點' },
  { key: 'connectedSpeech', title: '連音與音變' },
  { key: 'singingTips', title: '唱法提示' },
] as const

// Shown while the video is paused at the end of a segment.
export default function LessonCard({
  segment,
  locked = false,
  lang,
  onSpeakText,
  savedLines,
  onToggleSaveLine,
  isLast,
  autoMode,
  countdown,
  speaking,
  canSpeak,
  onReplay,
  onContinue,
  onToggleAuto,
  onSpeakWords,
  onSpeakSlow,
  onStopSpeaking,
  children,
}: Props) {
  const { lesson } = segment
  const filled = SECTIONS.filter(({ key }) => (lesson[key] ?? []).length > 0)
  return (
    <section
      aria-label="這段的教學"
      aria-busy={locked}
      className={`rounded-lg border border-rule bg-sheet p-5 transition-opacity sm:p-6 ${locked ? 'opacity-60' : ''}`}
    >
      {locked && (
        <p className="mb-3 text-sm font-medium text-ink" role="status">
          重播中…播完這段會自動停下
        </p>
      )}
      {/* A disabled fieldset disables every button, input and textarea inside it. */}
      <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0 disabled:[&_button]:cursor-not-allowed">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={speaking === 'words' ? onStopSpeaking : onSpeakWords}
          disabled={!canSpeak}
          className="rounded-md border border-ink px-4 py-2 font-medium hover:bg-paper disabled:opacity-50"
        >
          {speaking === 'words' ? '停止' : '逐字念給我聽'}
        </button>
        <button
          type="button"
          onClick={speaking === 'slow' ? onStopSpeaking : onSpeakSlow}
          disabled={!canSpeak}
          className="rounded-md border border-ink px-4 py-2 font-medium hover:bg-paper disabled:opacity-50"
        >
          {speaking === 'slow' ? '停止' : '整句慢慢念'}
        </button>
        <button
          type="button"
          onClick={onReplay}
          className="rounded-md border border-ink px-4 py-2 font-medium hover:bg-paper disabled:opacity-50"
        >
          重播這段
        </button>
        <span className="text-sm text-muted">
          {canSpeak
            ? '也可以點上面的任何一個字，聽它怎麼念、看中文意思。'
            : '這台裝置沒有這個語言的朗讀語音，可以到系統設定安裝。'}
        </span>
      </div>

      {onToggleSaveLine && savedLines && (
        <div className="mb-5 flex flex-wrap gap-2">
          {segment.lines.map((line, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onToggleSaveLine(i)}
              aria-pressed={savedLines[i]}
              className={`max-w-full truncate rounded-md border px-3 py-1 text-sm disabled:opacity-50 ${
                savedLines[i] ? 'border-ink bg-ink text-white' : 'border-rule hover:border-ink'
              }`}
            >
              {savedLines[i] ? '已收藏：' : '收藏這句：'}
              <span lang={lang}>{line.text}</span>
            </button>
          ))}
        </div>
      )}

      {filled.length === 0 && (
        <p className="text-sm text-muted">這段沒有特別需要注意的地方，重播幾次跟著唱看看。</p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {filled.map(({ key, title }) => (
          <div key={key}>
            <h3 className="mb-2 text-sm font-bold text-ink">{title}</h3>
            <ul className="space-y-2 text-[15px] leading-relaxed text-ink-soft">
              {(lesson[key] ?? []).map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <PatternDrill
        key={segment.id}
        patterns={lesson.patterns ?? []}
        lang={lang}
        canSpeak={canSpeak}
        onSpeak={onSpeakText}
      />

      {children}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-4">
        <button
          type="button"
          onClick={onReplay}
          className="rounded-md border border-ink px-4 py-2 font-medium hover:bg-paper disabled:opacity-50"
        >
          重播這段 <kbd className="ml-1 text-xs text-muted">R</kbd>
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-ink px-4 py-2 font-medium text-white hover:bg-ink-soft disabled:opacity-50"
        >
          {isLast ? '播完剩下的部分' : '繼續下一段'}{' '}
          <kbd className="ml-1 text-xs text-white/70">Space</kbd>
        </button>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={autoMode} onChange={onToggleAuto} className="accent-ink" />
          自動繼續
          {countdown !== null && <span className="tabular-nums text-muted">（{countdown} 秒）</span>}
        </label>
      </div>
      </fieldset>
    </section>
  )
}

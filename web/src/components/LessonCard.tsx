import type { Segment, Song } from '../types/timeline'
import PatternDrill from './PatternDrill'

interface Props {
  segment: Segment
  lang: Song['sourceLang']
  onSpeakText: (text: string) => void
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
  lang,
  onSpeakText,
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
}: Props) {
  const { lesson } = segment
  const filled = SECTIONS.filter(({ key }) => (lesson[key] ?? []).length > 0)
  return (
    <section aria-label="這段的教學" className="rounded-lg border border-rule bg-sheet p-5 sm:p-6">
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
        <span className="text-sm text-muted">
          {canSpeak
            ? '也可以點上面的任何一個字，聽它怎麼念、看中文意思。'
            : '這台裝置沒有這個語言的朗讀語音，可以到系統設定安裝。'}
        </span>
      </div>

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

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-4">
        <button
          type="button"
          onClick={onReplay}
          className="rounded-md border border-ink px-4 py-2 font-medium hover:bg-paper"
        >
          重播這段 <kbd className="ml-1 text-xs text-muted">R</kbd>
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-ink px-4 py-2 font-medium text-white hover:bg-ink-soft"
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
    </section>
  )
}

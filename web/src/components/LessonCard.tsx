import type { Segment } from '../types/timeline'

interface Props {
  segment: Segment
  isLast: boolean
  autoMode: boolean
  countdown: number | null
  onReplay: () => void
  onContinue: () => void
  onToggleAuto: () => void
}

const SECTIONS = [
  { key: 'pronunciationNotes', title: '發音重點' },
  { key: 'connectedSpeech', title: '連音與音變' },
  { key: 'singingTips', title: '唱法提示' },
] as const

// Shown while the video is paused at the end of a segment.
export default function LessonCard({
  segment,
  isLast,
  autoMode,
  countdown,
  onReplay,
  onContinue,
  onToggleAuto,
}: Props) {
  const { lesson } = segment
  return (
    <section aria-label="這段的教學" className="rounded-lg border border-rule bg-sheet p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-3">
        {SECTIONS.map(({ key, title }) =>
          lesson[key].length ? (
            <div key={key}>
              <h3 className="mb-2 text-sm font-bold text-ink">{title}</h3>
              <ul className="space-y-2 text-[15px] leading-relaxed text-ink-soft">
                {lesson[key].map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </div>

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
        <button
          type="button"
          disabled
          title="P4 加入慢速念法"
          className="rounded-md border border-rule px-4 py-2 text-muted"
        >
          慢速念法
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

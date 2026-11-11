import { stageLabel, type JobRow } from '../lib/lessonApi'
import { LANG_LABEL } from '../lib/samples'

export default function ProcessingStatus({ job }: { job: JobRow }) {
  const pct = job.status === 'pending' ? 0 : job.progress
  return (
    <section aria-live="polite" className="max-w-xl space-y-4 rounded-lg border border-rule bg-sheet p-6">
      <h1 className="text-xl font-bold">正在產生{LANG_LABEL[job.source_lang]}逐句教學</h1>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-full bg-rule"
      >
        <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-ink-soft">
        {stageLabel(job)}
        {job.status === 'processing' && <span className="ml-2 tabular-nums text-muted">{pct}%</span>}
      </p>
      <p className="text-sm text-muted">這個頁面會自動更新，處理完成後就會開始播放。</p>
    </section>
  )
}

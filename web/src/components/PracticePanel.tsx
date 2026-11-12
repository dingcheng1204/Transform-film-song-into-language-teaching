import type { DictationResult } from '../lib/dictation'
import type { RecorderState } from '../lib/recorder'
import type { Song } from '../types/timeline'

export type Practice = 'dictation' | 'shadow' | null

interface Props {
  practice: Practice
  onPractice: (p: Practice) => void
  lang: Song['sourceLang']
  // dictation
  answer: string
  onAnswer: (s: string) => void
  results: DictationResult[] | null
  onCheck: () => void
  onRetry: () => void
  // shadowing
  recorder: RecorderState
  hasRecording: boolean
  onRecord: () => void
  onRecordWithSong: () => void
  onStopRecording: () => void
  onPlayMine: () => void
  onCompare: () => void
  // shared
  onReplay: () => void
}

const btn = 'rounded-md border border-ink px-3 py-1.5 text-sm hover:bg-paper disabled:opacity-50'

// 聽寫 (type what you hear) and 跟讀 (record yourself and compare), inside the lesson card.
export default function PracticePanel(p: Props) {
  return (
    <section aria-label="聽寫與跟讀" className="mt-6 border-t border-rule pt-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-bold text-ink">聽寫與跟讀</h3>
        <div role="tablist" className="flex rounded-md border border-rule p-0.5 text-sm">
          {(
            [
              ['dictation', '聽寫'],
              ['shadow', '跟讀'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              role="tab"
              aria-selected={p.practice === m}
              onClick={() => p.onPractice(p.practice === m ? null : m)}
              className={`rounded px-3 py-1 ${p.practice === m ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {p.practice === 'dictation' && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            歌詞先藏起來了。播這段，把聽到的打出來{p.lang === 'ja' ? '（可以全部打平假名）' : ''}，再對答案。
          </p>
          <textarea
            value={p.answer}
            onChange={(e) => p.onAnswer(e.target.value)}
            disabled={!!p.results}
            rows={2}
            lang={p.lang}
            aria-label="聽寫答案"
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-lg outline-none focus:border-ink"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={p.onReplay} className={btn}>
              播這段
            </button>
            {p.results ? (
              <button type="button" onClick={p.onRetry} className={btn}>
                再聽寫一次
              </button>
            ) : (
              <button type="button" onClick={p.onCheck} disabled={!p.answer.trim()} className={btn}>
                對答案
              </button>
            )}
          </div>
          {p.results && (
            <div className="space-y-2" aria-live="polite">
              {p.results.map((r, i) => (
                <div key={i}>
                  <p className="text-lg" lang={p.lang}>
                    {r.expected.map((m, j) => (
                      <span
                        key={j}
                        className={m.ok ? 'text-ink' : 'rounded bg-alert/10 text-alert underline decoration-wavy'}
                      >
                        {m.text}
                        {p.lang === 'ja' ? '' : ' '}
                      </span>
                    ))}
                  </p>
                  <p className="text-sm text-muted">
                    聽對 {Math.round(r.score * 100)}%
                    {r.extra.length > 0 && <span className="ml-3">多打的：{r.extra.join(' ')}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {p.practice === 'shadow' && (
        <div className="space-y-3">
          <p className="text-sm text-muted">先聽原唱，再錄下自己念或唱的，兩個輪流聽，找出不一樣的地方。錄音只存在這個瀏覽器，不會上傳。</p>
          {p.recorder === 'unsupported' && <p className="text-sm text-alert">這個瀏覽器不支援錄音。</p>}
          {p.recorder === 'denied' && (
            <p className="text-sm text-alert">沒有麥克風權限。請在瀏覽器網址列旁的設定允許使用麥克風，再試一次。</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={p.onReplay} className={btn}>
              播原唱
            </button>
            {p.recorder === 'recording' ? (
              <button type="button" onClick={p.onStopRecording} className={`${btn} border-alert text-alert`}>
                ● 錄音中，按這裡停止
              </button>
            ) : (
              <>
                <button type="button" onClick={p.onRecord} disabled={p.recorder === 'unsupported'} className={btn}>
                  錄下我念的
                </button>
                <button
                  type="button"
                  onClick={p.onRecordWithSong}
                  disabled={p.recorder === 'unsupported'}
                  className={btn}
                  title="建議戴耳機，避免錄到原唱"
                >
                  邊播邊跟著唱（戴耳機）
                </button>
              </>
            )}
            <button type="button" onClick={p.onPlayMine} disabled={!p.hasRecording} className={btn}>
              播我的錄音
            </button>
            <button type="button" onClick={p.onCompare} disabled={!p.hasRecording} className={btn}>
              原唱 → 我的錄音
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

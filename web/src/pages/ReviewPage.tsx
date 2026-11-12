import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import ClipPlayer from '../components/ClipPlayer'
import { useAuth } from '../lib/auth'
import { LANG_LABEL } from '../lib/samples'
import { reviewItem, useDueItems, useTotalSaved, type SavedItem } from '../lib/savedApi'
import { speak } from '../lib/speech'
import { previewInterval, RATING_LABEL, type Rating } from '../lib/srs'

// Spaced-repetition review of saved words and lines.
//   word: see the word (and hear it) → recall its meaning
//   line: see the Chinese → say the line → reveal, hear the original
export default function ReviewPage() {
  const { user, loading } = useAuth()
  const due = useDueItems()
  const total = useTotalSaved()
  const qc = useQueryClient()
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [doneCount, setDoneCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <p className="text-muted">載入中…</p>
  if (!user)
    return (
      <p>
        <Link to="/login?next=/review" className="underline">
          登入
        </Link>
        後就能收藏單字和句子，並在這裡複習。
      </p>
    )
  if (due.isPending) return <p className="text-muted">載入中…</p>

  const items = due.data ?? []
  const item: SavedItem | undefined = items[index]

  if (!item)
    return (
      <section className="max-w-xl space-y-3">
        <h1 className="text-2xl font-bold">複習</h1>
        {doneCount > 0 && <p>這一輪複習了 {doneCount} 張卡片。</p>}
        <p className="text-ink-soft">
          {total.data
            ? '目前沒有到期的卡片，明天再回來看看。'
            : '還沒有收藏任何東西。在歌曲的教學卡片裡點「收藏」，就會出現在這裡。'}
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0)
            setDoneCount(0)
            qc.invalidateQueries({ queryKey: ['due'] })
          }}
          className="rounded-md border border-ink px-4 py-2"
        >
          重新整理
        </button>
      </section>
    )

  async function rate(r: Rating) {
    if (!item) return
    setBusy(true)
    setError(null)
    try {
      await reviewItem(item, r)
      setDoneCount((c) => c + 1)
      setRevealed(false)
      setIndex((i) => i + 1)
      qc.invalidateQueries({ queryKey: ['due', user?.id, 'count'] })
    } catch {
      setError('儲存失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  const lang = item.source_lang
  const isWord = item.kind === 'word'
  const sayIt = () => speak(lang === 'ja' && isWord && item.reading ? item.reading : item.text, lang, 0.9)

  return (
    <section className="max-w-2xl space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">複習</h1>
        <span className="text-sm tabular-nums text-muted">
          {index + 1} / {items.length}
        </span>
      </div>

      <article className="space-y-5 rounded-lg border border-rule bg-sheet p-6" aria-live="polite">
        <p className="text-sm text-muted">
          {LANG_LABEL[lang]}
          {isWord ? '單字：想想它的意思' : '句子：看中文，用原文說說看'}
        </p>

        {isWord ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-4xl font-medium" lang={lang}>
              {item.text}
            </span>
            <button type="button" onClick={sayIt} className="rounded-md border border-ink px-3 py-1 text-sm">
              念給我聽
            </button>
          </div>
        ) : (
          <p className="text-2xl" lang="zh-Hant">
            {item.meaning || '（沒有翻譯）'}
          </p>
        )}

        {revealed ? (
          <div className="space-y-3 border-t border-rule pt-4">
            {isWord ? (
              <>
                <p className="text-2xl" lang="zh-Hant">
                  {item.meaning || '（沒有中文解釋）'}
                </p>
                <p className="text-ink-soft">
                  {item.reading && item.reading !== item.text && <span lang={lang}>{item.reading}</span>}
                  {item.romanization && <span className="ml-3">{item.romanization}</span>}
                </p>
                {item.context && (
                  <p className="text-sm text-muted" lang={lang}>
                    出自：{item.context}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-3xl font-medium" lang={lang}>
                  {item.text}
                </p>
                {(item.reading || item.romanization) && (
                  <p className="text-ink-soft">
                    {item.reading && <span lang={lang}>{item.reading}</span>}
                    {item.romanization && <span className="ml-3">{item.romanization}</span>}
                  </p>
                )}
                <button type="button" onClick={sayIt} className="rounded-md border border-ink px-3 py-1 text-sm">
                  念給我聽
                </button>
              </>
            )}
            <ClipPlayer key={item.id} youtubeId={item.youtube_id} start={item.start_sec} end={item.end_sec} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="rounded-md bg-ink px-5 py-2.5 font-medium text-white hover:bg-ink-soft"
          >
            看答案
          </button>
        )}
      </article>

      {revealed && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([1, 2, 3, 4] as Rating[]).map((r) => (
            <button
              key={r}
              type="button"
              disabled={busy}
              onClick={() => rate(r)}
              className={`rounded-md border px-3 py-2 disabled:opacity-50 ${
                r === 3 ? 'border-ink bg-ink text-white hover:bg-ink-soft' : 'border-ink hover:bg-sheet'
              }`}
            >
              <span className="block font-medium">{RATING_LABEL[r]}</span>
              <span className={`text-xs ${r === 3 ? 'text-white/70' : 'text-muted'}`}>{previewInterval(item, r)}後</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-alert">{error}</p>}
      <p className="text-sm text-muted">
        出自
        <Link to={`/lesson/${item.youtube_id}?lang=${lang}`} className="mx-1 underline">
          這首歌的第 {item.segment_id + 1} 段
        </Link>
      </p>
    </section>
  )
}

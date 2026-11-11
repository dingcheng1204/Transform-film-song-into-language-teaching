import { useEffect, useState } from 'react'
import { createJob, errorMessage, JobRequestError, type JobRow } from '../lib/lessonApi'
import { LANG_LABEL, type Lang } from '../lib/samples'
import { playerErrorMessage, useYouTubePlayer } from '../lib/useYouTubePlayer'
import { checkVideo, formatDuration, type VideoCheckResult } from '../lib/videoCheck'
import { MAX_DURATION_SEC } from '../lib/youtube'

interface Props {
  youtubeId: string
  lastJob: JobRow | null
  onQueued: (job: JobRow) => void
}

// Shown when the video has no timeline yet: preview, ≤ 6 min check, pick language, enqueue.
export default function StartProcessing({ youtubeId, lastJob, onQueued }: Props) {
  const { containerRef, playerRef, ready, error } = useYouTubePlayer(youtubeId)
  const [server, setServer] = useState<VideoCheckResult | null>(null)
  const [playerDuration, setPlayerDuration] = useState<number | null>(null)
  const [lang, setLang] = useState<Lang | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    checkVideo(youtubeId).then((r) => {
      if (!live) return
      setServer(r)
      if (r.status === 'ok' && r.langHint) setLang((l) => l ?? r.langHint ?? null)
    })
    return () => {
      live = false
    }
  }, [youtubeId])

  useEffect(() => {
    if (ready) setPlayerDuration(playerRef.current?.getDuration() ?? null)
  }, [ready, playerRef])

  let verdict: { ok: boolean; text: string } | null = null
  if (server?.status === 'rejected') verdict = { ok: false, text: server.message }
  else if (server?.status === 'ok')
    verdict = { ok: true, text: `長度 ${formatDuration(server.durationSec ?? 0)}` }
  else if (server?.status === 'unknown' && playerDuration)
    verdict =
      playerDuration > MAX_DURATION_SEC
        ? { ok: false, text: `影片長度 ${formatDuration(playerDuration)}，超過 6 分鐘，請換一首比較短的歌。` }
        : { ok: true, text: `長度 ${formatDuration(playerDuration)}` }

  async function submit() {
    if (!lang) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      onQueued(await createJob(youtubeId, lang))
    } catch (e) {
      setSubmitError(errorMessage(e instanceof JobRequestError ? e.code : null))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="aspect-video overflow-hidden rounded-lg bg-ink/90" ref={containerRef} />
      {error !== null && <p className="text-alert">{playerErrorMessage(error)}</p>}
      {server?.status === 'ok' && server.title && <h1 className="text-xl font-bold">{server.title}</h1>}
      {verdict && <p className={verdict.ok ? 'text-ink-soft' : 'text-alert'}>{verdict.text}</p>}

      {lastJob?.status === 'failed' && (
        <p className="text-alert">上次處理失敗：{errorMessage(lastJob.error)}</p>
      )}

      {verdict?.ok && (
        <div className="space-y-4 rounded-lg border border-rule bg-sheet p-5">
          <fieldset>
            <legend className="mb-2 font-bold">這首歌是用什麼語言唱的？</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                <label
                  key={l}
                  className={`cursor-pointer rounded-md border px-4 py-2 ${
                    lang === l ? 'border-ink bg-paper font-medium' : 'border-rule'
                  }`}
                >
                  <input
                    type="radio"
                    name="lang"
                    value={l}
                    checked={lang === l}
                    onChange={() => setLang(l)}
                    className="sr-only"
                  />
                  {LANG_LABEL[l]}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            disabled={!lang || submitting}
            onClick={submit}
            className="rounded-md bg-ink px-5 py-2.5 font-medium text-white hover:bg-ink-soft disabled:opacity-50"
          >
            {submitting ? '送出中…' : '產生逐句教學'}
          </button>
          {submitError && <p className="text-sm text-alert">{submitError}</p>}
          <p className="text-sm text-muted">一首 4 分鐘的歌大約要處理 5 到 15 分鐘，可以先離開，之後回到這個網址查看。</p>
        </div>
      )}
    </div>
  )
}

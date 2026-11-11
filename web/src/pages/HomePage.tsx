import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { LANG_LABEL, SAMPLES, type Lang } from '../lib/samples'
import { checkVideo } from '../lib/videoCheck'
import { MAX_DURATION_SEC, parseYouTubeId } from '../lib/youtube'

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const id = parseYouTubeId(url)
    if (!id) {
      setError('這不是 YouTube 影片網址。請貼上像 youtube.com/watch?v=… 或 youtu.be/… 的連結。')
      return
    }
    setChecking(true)
    const r = await checkVideo(id)
    setChecking(false)
    if (r.status === 'rejected') {
      setError(r.message)
      return
    }
    navigate(`/lesson/${id}`)
  }

  return (
    <div className="space-y-14">
      <section className="max-w-2xl space-y-5">
        <h1 className="text-3xl font-bold leading-snug sm:text-4xl">
          一句一句，
          <br />
          把喜歡的歌唱對。
        </h1>
        <p className="text-lg leading-relaxed text-ink-soft">
          貼上日文、英文或韓文歌的 YouTube 網址（{MAX_DURATION_SEC / 60} 分鐘以內）。每唱完一兩句就停下來，
          告訴你怎麼念、哪裡連音、哪裡換氣，再接著唱。
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="url" className="sr-only">
            YouTube 網址
          </label>
          <input
            id="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError(null)
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 rounded-md border border-rule bg-sheet px-3 py-2.5 outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={checking}
            className="rounded-md bg-ink px-5 py-2.5 font-medium text-white hover:bg-ink-soft disabled:opacity-60"
          >
            {checking ? '檢查中…' : '開始練習'}
          </button>
        </form>
        {error && <p className="text-sm text-alert">{error}</p>}
      </section>

      <section aria-labelledby="demos" className="space-y-4">
        <h2 id="demos" className="text-lg font-bold">
          先試試看
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(SAMPLES) as Lang[]).map((lang) => {
            const first = SAMPLES[lang].segments[0].lines[0]
            return (
              <Link
                key={lang}
                to={`/demo/${lang}`}
                className="block rounded-lg border border-rule bg-sheet p-4 hover:border-ink"
              >
                <span className="text-sm text-muted">{LANG_LABEL[lang]}示範</span>
                <span className="mt-1 block text-xl font-medium" lang={lang}>
                  {first.text}
                </span>
                <span className="mt-1 block text-sm text-ink-soft">{first.translation}</span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

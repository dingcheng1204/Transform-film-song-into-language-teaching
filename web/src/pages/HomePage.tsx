import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { MAX_DURATION_SEC, parseYouTubeId } from '../lib/youtube'

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const id = parseYouTubeId(url)
    if (!id) {
      setError('不是有效的 YouTube 網址')
      return
    }
    // P1: call POST /api/jobs to check duration ≤ 6 min before navigating.
    navigate(`/lesson/${id}`)
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">把一首歌變成逐句發音教學</h1>
        <p className="mt-2 text-stone-600">
          貼上 YouTube 歌曲網址（不超過 {MAX_DURATION_SEC / 60} 分鐘）。每播一到兩句會自動暫停，
          顯示念法、中英／中日字幕和唱法提示。
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError(null)
          }}
          placeholder="https://www.youtube.com/watch?v=..."
          className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 outline-none focus:border-stone-500"
        />
        <button
          type="submit"
          className="rounded-md bg-stone-900 px-4 py-2 font-medium text-white hover:bg-stone-700"
        >
          開始
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  )
}

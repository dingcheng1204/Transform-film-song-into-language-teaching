import { Link, useParams } from 'react-router'
import LessonPlayer from '../components/LessonPlayer'
import { LANG_LABEL, SAMPLES, type Lang } from '../lib/samples'

export default function DemoPage() {
  const { lang } = useParams()
  const timeline = lang && lang in SAMPLES ? SAMPLES[lang as Lang] : null
  if (!timeline) {
    return (
      <p>
        沒有這個示範。<Link to="/" className="underline">回首頁</Link>
      </p>
    )
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">{LANG_LABEL[timeline.song.sourceLang]}示範</h1>
        <p className="text-sm text-muted">
          示範用的歌詞是自編的句子，配上 YouTube 官方的測試影片，時間軸不會對上畫面。
        </p>
      </div>
      <LessonPlayer key={lang} timeline={timeline} />
    </div>
  )
}

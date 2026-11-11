import { useParams } from 'react-router'

// P1 replaces this with the IFrame player + pause/lesson-card loop.
export default function LessonPage() {
  const { youtubeId } = useParams()
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Lesson: {youtubeId}</h1>
      <p className="text-stone-600">播放器與教學卡片會在 P1 加入。</p>
    </section>
  )
}

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'
import LessonPlayer from '../components/LessonPlayer'
import ProcessingStatus from '../components/ProcessingStatus'
import StartProcessing from '../components/StartProcessing'
import { fetchLesson, type JobRow, type Lesson } from '../lib/lessonApi'
import { LANG_LABEL, type Lang } from '../lib/samples'

const isActive = (job: JobRow | null) => job?.status === 'pending' || job?.status === 'processing'

export default function LessonPage() {
  const { youtubeId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()

  const lesson = useQuery({
    queryKey: ['lesson', youtubeId],
    queryFn: () => fetchLesson(youtubeId),
    refetchInterval: (q) => (isActive(q.state.data?.job ?? null) ? 3000 : false),
  })

  if (lesson.isPending) return <p className="text-muted">載入中…</p>

  const data: Lesson = lesson.data ?? { timelines: {}, job: null }
  const job = data.job

  if (isActive(job)) return <ProcessingStatus job={job!} />

  const langs = Object.keys(data.timelines) as Lang[]
  if (langs.length) {
    const wanted = params.get('lang') as Lang | null
    const lang = wanted && langs.includes(wanted) ? wanted : langs[0]
    const timeline = data.timelines[lang]!
    const hasLessons = timeline.segments.some(
      (s) => s.lesson.pronunciationNotes.length + s.lesson.connectedSpeech.length + s.lesson.singingTips.length,
    )
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">{timeline.song.title}</h1>
          {langs.length > 1 && (
            <div className="flex gap-2" role="tablist">
              {langs.map((l) => (
                <button
                  key={l}
                  role="tab"
                  aria-selected={l === lang}
                  onClick={() => setParams({ lang: l })}
                  className={`rounded-md px-3 py-1 text-sm ${l === lang ? 'bg-ink text-white' : 'border border-rule'}`}
                >
                  {LANG_LABEL[l]}
                </button>
              ))}
            </div>
          )}
        </div>
        {!hasLessons && (
          <p className="text-sm text-muted">
            目前有逐字時間和自動暫停；翻譯、發音標註和教學說明會在下一個版本加入。
          </p>
        )}
        <LessonPlayer key={lang} timeline={timeline} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {lesson.isError && (
        <p className="text-sm text-alert">讀不到處理紀錄，伺服器的資料庫連線可能還沒設定好。</p>
      )}
      <StartProcessing
        youtubeId={youtubeId}
        lastJob={job}
        onQueued={(j) => queryClient.setQueryData<Lesson>(['lesson', youtubeId], { ...data, job: j })}
      />
    </div>
  )
}

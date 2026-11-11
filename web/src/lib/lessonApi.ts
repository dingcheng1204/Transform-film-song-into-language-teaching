import type { JobRow, LessonResponse } from '../../api/_lib/types'
import type { Timeline } from '../types/timeline'
import type { Lang } from './samples'

export type { JobRow }

export interface Lesson {
  timelines: Partial<Record<Lang, Timeline>>
  job: JobRow | null
}

export async function fetchLesson(id: string): Promise<Lesson> {
  const r = await fetch(`/api/lesson?id=${encodeURIComponent(id)}`)
  if (!r.ok) throw new Error(`lesson ${r.status}`)
  const d = (await r.json()) as LessonResponse
  return { timelines: d.timelines as Lesson['timelines'], job: d.job }
}

export class JobRequestError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export async function createJob(youtubeId: string, lang: Lang): Promise<JobRow> {
  const r = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ youtubeId, lang }),
  })
  const d = (await r.json().catch(() => ({}))) as { job?: JobRow; error?: string }
  if (!r.ok || !d.job) throw new JobRequestError(d.error ?? `http_${r.status}`)
  return d.job
}

const STAGE: Record<string, string> = {
  claimed: '準備中',
  requeued: '重新排隊中',
  probe: '讀取影片資訊',
  download: '下載音訊',
  separate: '分離人聲（最花時間的一步）',
  align: '辨識歌詞和每個字的時間',
  segment: '切分教學段落',
  done: '完成',
}

export function stageLabel(job: Pick<JobRow, 'status' | 'stage'>): string {
  if (job.status === 'pending') return '排隊中，等待處理程式領取'
  return STAGE[job.stage ?? ''] ?? '處理中'
}

const ERROR: Record<string, string> = {
  too_long: '影片超過 6 分鐘。',
  live_stream: '不支援直播影片。',
  unavailable: '讀不到這部影片，可能已刪除、設為私人或有地區限制。',
  download_failed: '下載音訊失敗，可以稍後再試一次。',
  separation_failed: '分離人聲失敗。',
  transcription_failed: '辨識歌詞失敗。',
  no_lyrics: '聽不到歌詞，可能是純音樂。',
  too_many_attempts: '處理程式多次中斷，已停止重試。',
  queue_full: '目前排隊的歌太多了，請稍後再送出。',
  not_found: '找不到這部影片，或影片已設為私人。',
  live: '不支援直播影片。',
  bad_duration: '讀不到影片長度。',
  no_api_key: '伺服器還沒設定 YouTube API 金鑰。',
  not_configured: '伺服器還沒設定資料庫連線。',
}

export function errorMessage(code: string | null | undefined): string {
  if (!code) return '處理失敗。'
  if (code.startsWith('internal')) return '處理程式發生內部錯誤，可以再試一次。'
  return ERROR[code] ?? '處理失敗，可以再試一次。'
}

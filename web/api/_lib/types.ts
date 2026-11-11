// Shared between Vercel Functions and the web app (type-only imports).
export type SupportedLangCode = 'ja' | 'en' | 'ko'

export interface JobRow {
  id: string
  youtube_id: string
  source_lang: SupportedLangCode
  status: 'pending' | 'processing' | 'done' | 'failed'
  stage: string | null
  progress: number
  error: string | null
}

export interface LessonResponse {
  timelines: Partial<Record<SupportedLangCode, unknown>>
  job: JobRow | null
}

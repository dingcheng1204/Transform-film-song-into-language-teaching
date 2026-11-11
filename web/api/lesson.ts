import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { JobRow, LessonResponse } from './_lib/types.js'
import { select, SupabaseError } from './_lib/supabase.js'

const ID = /^[A-Za-z0-9_-]{11}$/

// GET /api/lesson?id=<youtubeId>
// → { timelines: { [lang]: Timeline }, job: latest JobRow | null }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === 'string' ? req.query.id : ''
  if (!ID.test(id)) return res.status(400).json({ error: 'bad_id' })

  try {
    const [rows, jobs] = await Promise.all([
      select<{ source_lang: string; timeline: unknown }>('timelines', {
        youtube_id: `eq.${id}`,
        select: 'source_lang,timeline',
      }),
      select<JobRow>('jobs', {
        youtube_id: `eq.${id}`,
        select: 'id,youtube_id,source_lang,status,stage,progress,error',
        order: 'created_at.desc',
        limit: '1',
      }),
    ])
    res.setHeader('Cache-Control', 'no-store')
    const body: LessonResponse = {
      timelines: Object.fromEntries(rows.map((r) => [r.source_lang, r.timeline])),
      job: jobs[0] ?? null,
    }
    return res.status(200).json(body)
  } catch (e) {
    const status = e instanceof SupabaseError && e.status === 503 ? 503 : 502
    return res.status(status).json({ error: status === 503 ? 'not_configured' : 'database' })
  }
}

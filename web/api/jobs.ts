import type { VercelRequest, VercelResponse } from '@vercel/node'
import { rpc, SupabaseError } from './_lib/supabase.js'
import type { JobRow } from './_lib/types.js'
import { fetchVideoCheck, SUPPORTED_LANGS } from './_lib/video.js'

const ID = /^[A-Za-z0-9_-]{11}$/

// POST /api/jobs  { youtubeId, lang }
// Re-checks the video server-side (≤ 6 min, not live), then enqueues it.
// If the same video+language is already queued/running, returns that job.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const { youtubeId, lang } = (req.body ?? {}) as { youtubeId?: string; lang?: string }
  if (!youtubeId || !ID.test(youtubeId)) return res.status(400).json({ error: 'bad_id' })
  if (!lang || !(SUPPORTED_LANGS as readonly string[]).includes(lang))
    return res.status(400).json({ error: 'bad_lang' })

  const key = process.env.YOUTUBE_API_KEY
  if (!key) return res.status(503).json({ error: 'no_api_key' })

  let check
  try {
    check = await fetchVideoCheck(youtubeId, key)
  } catch {
    return res.status(502).json({ error: 'youtube_api' })
  }
  if (!check.ok) return res.status(422).json({ error: check.reason })

  try {
    const job = await rpc<JobRow>('enqueue_job', {
      p_youtube_id: youtubeId,
      p_source_lang: lang,
      p_title: check.title,
      p_duration_sec: check.durationSec,
    })
    return res.status(200).json({ job })
  } catch (e) {
    if (e instanceof SupabaseError) {
      if (e.body.includes('queue_full')) return res.status(429).json({ error: 'queue_full' })
      if (e.status === 503) return res.status(503).json({ error: 'not_configured' })
    }
    return res.status(502).json({ error: 'database' })
  }
}

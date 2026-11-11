import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchVideoCheck } from './_lib/video.js'

const ID = /^[A-Za-z0-9_-]{11}$/

// GET /api/video?id=<youtubeId>
// Checks the ≤ 6 min limit server-side with the YouTube Data API (key stays on the server).
// Returns 503 { error: "no_api_key" } when YOUTUBE_API_KEY is not configured — the client
// then falls back to the IFrame player's getDuration().
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === 'string' ? req.query.id : ''
  if (!ID.test(id)) return res.status(400).json({ error: 'bad_id' })

  const key = process.env.YOUTUBE_API_KEY
  if (!key) return res.status(503).json({ error: 'no_api_key' })

  try {
    const check = await fetchVideoCheck(id, key)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).json(check)
  } catch {
    return res.status(502).json({ error: 'youtube_api' })
  }
}

// Pure helpers for /api/video. Files under api/_lib are not exposed as routes.

export const MAX_DURATION_SEC = 360
export const SUPPORTED_LANGS = ['ja', 'en', 'ko'] as const
export type SupportedLang = (typeof SUPPORTED_LANGS)[number]

/** Parse an ISO 8601 duration like "PT4M13S" / "PT1H2M" / "P0D" into seconds. */
export function parseIsoDuration(iso: string): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso)
  if (!m || iso === 'P' || iso.endsWith('T')) return null
  const [, d, h, min, s] = m
  return (
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0)
  )
}

/** Map YouTube's defaultAudioLanguage (e.g. "ja", "en-US", "ko") to a supported lang, if any. */
export function langHint(code: string | undefined): SupportedLang | null {
  if (!code) return null
  const base = code.toLowerCase().split('-')[0]
  return (SUPPORTED_LANGS as readonly string[]).includes(base) ? (base as SupportedLang) : null
}

export type VideoCheck =
  | { ok: true; id: string; title: string; channel: string; durationSec: number; langHint: SupportedLang | null }
  | {
      ok: false
      id: string
      reason: 'not_found' | 'too_long' | 'live' | 'bad_duration'
      title?: string
      durationSec?: number
    }

interface YtItem {
  snippet?: {
    title?: string
    channelTitle?: string
    liveBroadcastContent?: string
    defaultAudioLanguage?: string
  }
  contentDetails?: { duration?: string }
}

/** Fetch one video from the YouTube Data API (1 quota unit) and decide. */
export async function fetchVideoCheck(id: string, key: string): Promise<VideoCheck> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'snippet,contentDetails')
  url.searchParams.set('id', id)
  url.searchParams.set('key', key)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`youtube_api ${r.status}`)
  const data = (await r.json()) as { items?: YtItem[] }
  return checkVideo(id, data.items?.[0])
}

/** Turn a YouTube Data API videos.list item into an accept/reject decision. */
export function checkVideo(id: string, item: YtItem | undefined): VideoCheck {
  if (!item) return { ok: false, id, reason: 'not_found' }
  const title = item.snippet?.title ?? ''
  const live = item.snippet?.liveBroadcastContent
  if (live && live !== 'none') return { ok: false, id, reason: 'live', title }
  const durationSec = parseIsoDuration(item.contentDetails?.duration ?? '')
  if (durationSec === null || durationSec === 0) return { ok: false, id, reason: 'bad_duration', title }
  if (durationSec > MAX_DURATION_SEC) return { ok: false, id, reason: 'too_long', title, durationSec }
  return {
    ok: true,
    id,
    title,
    channel: item.snippet?.channelTitle ?? '',
    durationSec,
    langHint: langHint(item.snippet?.defaultAudioLanguage),
  }
}

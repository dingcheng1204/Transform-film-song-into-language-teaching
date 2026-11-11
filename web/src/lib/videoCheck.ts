import { MAX_DURATION_SEC } from './youtube'

export type VideoCheckResult =
  | { status: 'ok'; title?: string; durationSec?: number }
  | { status: 'rejected'; message: string }
  /** Server can't check (no API key / network) — caller falls back to the player's duration. */
  | { status: 'unknown' }

const REASON: Record<string, string> = {
  not_found: '找不到這部影片，或影片已設為私人。',
  too_long: `影片超過 ${MAX_DURATION_SEC / 60} 分鐘，請換一首比較短的歌。`,
  live: '不支援直播影片。',
  bad_duration: '讀不到影片長度。',
}

export function formatDuration(sec: number): string {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export async function checkVideo(id: string): Promise<VideoCheckResult> {
  try {
    const r = await fetch(`/api/video?id=${encodeURIComponent(id)}`)
    if (!r.ok) return { status: 'unknown' }
    const d = (await r.json()) as {
      ok: boolean
      reason?: string
      title?: string
      durationSec?: number
    }
    if (d.ok) return { status: 'ok', title: d.title, durationSec: d.durationSec }
    let message = REASON[d.reason ?? ''] ?? '這部影片不能使用。'
    if (d.reason === 'too_long' && d.durationSec) message += `（目前 ${formatDuration(d.durationSec)}）`
    return { status: 'rejected', message }
  } catch {
    return { status: 'unknown' }
  }
}

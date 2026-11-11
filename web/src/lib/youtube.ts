// Extract the 11-char video id from common YouTube URL forms.
const ID = /^[A-Za-z0-9_-]{11}$/

export function parseYouTubeId(input: string): string | null {
  const s = input.trim()
  if (ID.test(s)) return s
  let url: URL
  try {
    url = new URL(s)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0]
  } else if (host === 'youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const m = url.pathname.match(/^\/(embed|shorts|live)\/([^/]+)/)
      if (m) id = m[2]
    }
  }
  return id && ID.test(id) ? id : null
}

export const MAX_DURATION_SEC = 360

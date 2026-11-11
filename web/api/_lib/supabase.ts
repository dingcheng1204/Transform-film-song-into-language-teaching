// Tiny PostgREST client for the song_teaching schema, using the publishable (anon) key.
// RLS allows SELECT on jobs/timelines and EXECUTE on enqueue_job only.

export class SupabaseError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`supabase ${status}: ${body.slice(0, 200)}`)
    this.status = status
    this.body = body
  }
}

export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  return url && key ? { url: url.replace(/\/$/, ''), key } : null
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cfg = supabaseConfig()
  if (!cfg) throw new SupabaseError(503, 'not_configured')
  const r = await fetch(`${cfg.url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      'Accept-Profile': 'song_teaching',
      'Content-Profile': 'song_teaching',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const text = await r.text()
  if (!r.ok) throw new SupabaseError(r.status, text)
  return (text ? JSON.parse(text) : null) as T
}

export function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return request<T>(`/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) })
}

export function select<T>(table: string, query: Record<string, string>): Promise<T[]> {
  return request<T[]>(`/${table}?${new URLSearchParams(query)}`)
}

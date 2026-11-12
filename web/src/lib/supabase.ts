// Browser Supabase client for auth + per-user data (saved items, reviews).
// Uses the publishable key; RLS limits every row to the signed-in user.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient<any, 'song_teaching'> | null =
  url && key
    ? createClient<any, 'song_teaching'>(url, key, {
        db: { schema: 'song_teaching' },
        auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
      })
    : null

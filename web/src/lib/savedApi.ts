// Saved words/lines and their review schedule (song_teaching.saved_items, RLS per user).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth'
import type { Lang } from './samples'
import { schedule, type Rating } from './srs'
import { supabase } from './supabase'

export interface SavedItem {
  id: string
  kind: 'word' | 'line'
  youtube_id: string
  source_lang: Lang
  segment_id: number
  text: string
  reading: string | null
  romanization: string | null
  meaning: string | null
  context: string | null
  start_sec: number
  end_sec: number
  ease: number
  interval_days: number
  repetitions: number
  lapses: number
  due_at: string
  last_reviewed_at: string | null
}

export type NewSavedItem = Pick<
  SavedItem,
  'kind' | 'youtube_id' | 'source_lang' | 'segment_id' | 'text' | 'start_sec' | 'end_sec'
> &
  Partial<Pick<SavedItem, 'reading' | 'romanization' | 'meaning' | 'context'>>

export const savedKey = (kind: SavedItem['kind'], text: string) => `${kind}:${text}`

function db() {
  if (!supabase) throw new Error('not_configured')
  return supabase
}

/** Map of savedKey → item id for one song, for the signed-in user. */
export function useSavedForSong(youtubeId: string, lang: Lang) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['saved', user?.id, youtubeId, lang],
    enabled: !!user && !!supabase,
    queryFn: async () => {
      const { data, error } = await db()
        .from('saved_items')
        .select('id, kind, text')
        .eq('youtube_id', youtubeId)
        .eq('source_lang', lang)
      if (error) throw error
      return new Map((data ?? []).map((r) => [savedKey(r.kind, r.text), r.id as string]))
    },
  })
}

export function useToggleSaved() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ item, savedId }: { item: NewSavedItem; savedId?: string }) => {
      if (!user) throw new Error('not_signed_in')
      if (savedId) {
        const { error } = await db().from('saved_items').delete().eq('id', savedId)
        if (error) throw error
        return
      }
      const { error } = await db()
        .from('saved_items')
        .upsert(
          { ...item, user_id: user.id, start_sec: round3(item.start_sec), end_sec: round3(item.end_sec) },
          { onConflict: 'user_id,kind,source_lang,youtube_id,text', ignoreDuplicates: true },
        )
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['saved'] })
      qc.invalidateQueries({ queryKey: ['due'] })
    },
  })
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

export function useDueItems() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['due', user?.id, 'items'],
    enabled: !!user && !!supabase,
    queryFn: async () => {
      const { data, error } = await db()
        .from('saved_items')
        .select('*')
        .lte('due_at', new Date().toISOString())
        .order('due_at')
        .limit(50)
      if (error) throw error
      return (data ?? []) as SavedItem[]
    },
  })
}

export function useDueCount() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['due', user?.id, 'count'],
    enabled: !!user && !!supabase,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await db()
        .from('saved_items')
        .select('id', { count: 'exact', head: true })
        .lte('due_at', new Date().toISOString())
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useTotalSaved() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['saved', user?.id, 'total'],
    enabled: !!user && !!supabase,
    queryFn: async () => {
      const { count, error } = await db().from('saved_items').select('id', { count: 'exact', head: true })
      if (error) throw error
      return count ?? 0
    },
  })
}

export async function reviewItem(item: SavedItem, rating: Rating): Promise<void> {
  const next = schedule(item, rating)
  const { error } = await db().from('saved_items').update(next).eq('id', item.id)
  if (error) throw error
  const log = await db()
    .from('review_logs')
    .insert({ item_id: item.id, rating, interval_days: next.interval_days })
  if (log.error) throw log.error
}

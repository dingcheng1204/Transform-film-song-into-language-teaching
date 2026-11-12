// SM-2 style spaced repetition with four buttons. Pure, so it is unit-tested.

export type Rating = 1 | 2 | 3 | 4 // again, hard, good, easy

export interface SrsState {
  ease: number
  interval_days: number
  repetitions: number
  lapses: number
}

export interface SrsResult extends SrsState {
  due_at: string
  last_reviewed_at: string
}

export const RATING_LABEL: Record<Rating, string> = { 1: '忘了', 2: '有點難', 3: '記得', 4: '很簡單' }

const MIN_EASE = 1.3
const MAX_EASE = 3.0
const AGAIN_MINUTES = 10

const clampEase = (e: number) => Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, e)) * 100) / 100

export function schedule(state: SrsState, rating: Rating, now: Date = new Date()): SrsResult {
  let { ease, interval_days: interval, repetitions, lapses } = state
  let dueMs: number

  if (rating === 1) {
    lapses += 1
    repetitions = 0
    interval = 0
    ease = clampEase(ease - 0.2)
    dueMs = now.getTime() + AGAIN_MINUTES * 60_000
  } else {
    if (rating === 2) {
      interval = repetitions === 0 ? 1 : Math.max(interval + 1, Math.round(interval * 1.2))
      ease = clampEase(ease - 0.15)
    } else if (rating === 3) {
      interval = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease))
    } else {
      interval = repetitions === 0 ? 4 : Math.max(interval + 2, Math.round(interval * ease * 1.3))
      ease = clampEase(ease + 0.15)
    }
    repetitions += 1
    dueMs = now.getTime() + interval * 86_400_000
  }

  return {
    ease,
    interval_days: interval,
    repetitions,
    lapses,
    due_at: new Date(dueMs).toISOString(),
    last_reviewed_at: now.toISOString(),
  }
}

/** Human-readable next interval for a button hint, e.g. "10 分鐘", "3 天". */
export function previewInterval(state: SrsState, rating: Rating): string {
  const r = schedule(state, rating, new Date(0))
  if (rating === 1) return `${AGAIN_MINUTES} 分鐘`
  return r.interval_days >= 30 ? `${Math.round(r.interval_days / 30)} 個月` : `${r.interval_days} 天`
}

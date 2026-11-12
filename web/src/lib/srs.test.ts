import { describe, expect, it } from 'vitest'
import { previewInterval, schedule, type SrsState } from './srs'

const fresh: SrsState = { ease: 2.5, interval_days: 0, repetitions: 0, lapses: 0 }
const now = new Date('2026-11-12T00:00:00Z')
const days = (r: { due_at: string }) => (Date.parse(r.due_at) - now.getTime()) / 86_400_000

describe('schedule', () => {
  it('good on a new card: 1 day, then 3 days, then interval × ease', () => {
    const a = schedule(fresh, 3, now)
    expect([a.interval_days, a.repetitions, days(a)]).toEqual([1, 1, 1])
    const b = schedule(a, 3, now)
    expect(b.interval_days).toBe(3)
    const c = schedule(b, 3, now)
    expect(c.interval_days).toBe(8) // round(3 × 2.5)
  })

  it('again resets repetitions, counts a lapse, lowers ease, due in 10 minutes', () => {
    const learned = { ease: 2.5, interval_days: 20, repetitions: 4, lapses: 0 }
    const r = schedule(learned, 1, now)
    expect(r).toMatchObject({ repetitions: 0, interval_days: 0, lapses: 1, ease: 2.3 })
    expect(Date.parse(r.due_at) - now.getTime()).toBe(10 * 60_000)
  })

  it('hard grows slowly and lowers ease; easy grows fast and raises ease', () => {
    const s = { ease: 2.5, interval_days: 10, repetitions: 3, lapses: 0 }
    expect(schedule(s, 2, now)).toMatchObject({ interval_days: 12, ease: 2.35 })
    expect(schedule(s, 4, now)).toMatchObject({ interval_days: 33, ease: 2.65 })
  })

  it('ease is clamped to [1.3, 3.0]', () => {
    expect(schedule({ ...fresh, ease: 1.35 }, 1, now).ease).toBe(1.3)
    expect(schedule({ ...fresh, ease: 2.95 }, 4, now).ease).toBe(3)
  })

  it('records the review time', () => {
    expect(schedule(fresh, 3, now).last_reviewed_at).toBe(now.toISOString())
  })
})

it('previewInterval', () => {
  expect(previewInterval(fresh, 1)).toBe('10 分鐘')
  expect(previewInterval(fresh, 4)).toBe('4 天')
  expect(previewInterval({ ease: 2.5, interval_days: 40, repetitions: 5, lapses: 0 }, 3)).toBe('3 個月')
})

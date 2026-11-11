import { describe, expect, it } from 'vitest'
import { activeWordIndex, currentIndex, lastPassed, tick } from './segments'

const segs = [
  { start: 2, end: 7.5 },
  { start: 8, end: 11 },
  { start: 11.2, end: 14 },
]

/** Simulate polling every 50 ms from `from` to `to`, starting with lastPaused. */
function play(from: number, to: number, lastPaused: number) {
  const pauses: number[] = []
  let prev = from
  let lp = lastPaused
  for (let t = from; t <= to; t += 0.05) {
    const r = tick(segs, t, prev, lp)
    lp = r.lastPaused
    if (r.pauseIdx !== null) {
      pauses.push(r.pauseIdx)
      return { pauses, at: t, lp }
    }
    prev = t
  }
  return { pauses, at: to, lp }
}

describe('tick', () => {
  it('pauses at the end of the first segment', () => {
    const r = play(0, 20, -1)
    expect(r.pauses).toEqual([0])
    expect(r.at).toBeGreaterThanOrEqual(7.45)
    expect(r.at).toBeLessThan(7.55)
  })

  it('after continue, does not re-pause on the same segment and pauses at the next', () => {
    const first = play(0, 20, -1)
    const second = play(first.at, 20, first.lp)
    expect(second.pauses).toEqual([1])
    expect(second.at).toBeGreaterThanOrEqual(10.95)
  })

  it('seeking forward past segments does not fire them', () => {
    expect(tick(segs, 12, 3, -1)).toEqual({ pauseIdx: null, lastPaused: 1 })
  })

  it('seeking back re-arms earlier segments', () => {
    const r = tick(segs, 3, 12, 1)
    expect(r).toEqual({ pauseIdx: null, lastPaused: -1 })
    expect(play(3, 20, r.lastPaused).pauses).toEqual([0])
  })

  it('replay (seek to segment start with lastPaused = i-1) pauses at that segment again', () => {
    expect(play(8, 20, 0).pauses).toEqual([1])
  })

  it('a laggy tick that skips a short gap pauses at the latest passed segment', () => {
    expect(tick(segs, 11.0, 10.5, 0)).toEqual({ pauseIdx: 1, lastPaused: 1 })
  })
})

describe('helpers', () => {
  it('lastPassed', () => {
    expect(lastPassed(segs, 0)).toBe(-1)
    expect(lastPassed(segs, 7.46)).toBe(0)
    expect(lastPassed(segs, 100)).toBe(2)
  })

  it('currentIndex', () => {
    expect(currentIndex(segs, 0)).toBe(0)
    expect(currentIndex(segs, 7.6)).toBe(1)
    expect(currentIndex(segs, 99)).toBe(2)
  })

  it('activeWordIndex', () => {
    const words = [
      { start: 2, end: 2.4 },
      { start: 2.4, end: 2.6 },
    ]
    expect(activeWordIndex(words, 2.1)).toBe(0)
    expect(activeWordIndex(words, 2.4)).toBe(1)
    expect(activeWordIndex(words, 3)).toBe(-1)
  })
})

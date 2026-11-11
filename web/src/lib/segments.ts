// Pure playback logic: when to pause, which segment/word is active.
// Kept free of React and the YouTube API so it can be unit-tested.

export interface Timed {
  start: number
  end: number
}

/** Pause this many seconds before a segment's end, to absorb the polling interval. */
export const END_EPS = 0.05
/** A jump in currentTime larger than this between ticks is treated as a seek. */
export const SEEK_JUMP = 1.0

/** Index of the last segment whose end has been reached at time t, or -1. */
export function lastPassed(segments: readonly Timed[], t: number): number {
  let k = -1
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].end - END_EPS <= t) k = i
    else break
  }
  return k
}

export interface TickResult {
  /** Segment to pause on and show the lesson for, or null to keep playing. */
  pauseIdx: number | null
  lastPaused: number
}

/**
 * Called every poll while the video plays.
 * - Normal playback: pause once when a new segment end is crossed.
 * - Seek (big jump either way): re-baseline so segments already behind t don't fire.
 * - After "continue", lastPaused === the segment just taught, so it won't re-fire.
 */
export function tick(
  segments: readonly Timed[],
  t: number,
  prevT: number,
  lastPaused: number,
): TickResult {
  const passed = lastPassed(segments, t)
  if (Math.abs(t - prevT) > SEEK_JUMP) return { pauseIdx: null, lastPaused: passed }
  if (passed > lastPaused) return { pauseIdx: passed, lastPaused: passed }
  return { pauseIdx: null, lastPaused }
}

/** Segment to show subtitles for at time t: the first one not yet ended. */
export function currentIndex(segments: readonly Timed[], t: number): number {
  const i = segments.findIndex((s) => t < s.end - END_EPS)
  return i === -1 ? segments.length - 1 : i
}

/** Index of the word being sung at t, or -1 if between words. */
export function activeWordIndex(words: readonly Timed[], t: number): number {
  return words.findIndex((w) => t >= w.start && t < w.end)
}

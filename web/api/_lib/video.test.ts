import { describe, expect, it } from 'vitest'
import { checkVideo, langHint, parseIsoDuration } from './video.js'

describe('parseIsoDuration', () => {
  it.each([
    ['PT4M13S', 253],
    ['PT6M', 360],
    ['PT6M1S', 361],
    ['PT1H2M3S', 3723],
    ['PT45S', 45],
    ['P1DT1S', 86401],
    ['P0D', 0],
  ])('%s → %d', (iso, sec) => expect(parseIsoDuration(iso)).toBe(sec))

  it.each(['', 'P', 'PT', '4:13', 'PTXM'])('rejects %j', (iso) =>
    expect(parseIsoDuration(iso)).toBeNull(),
  )
})

describe('langHint', () => {
  it.each([
    ['ja', 'ja'],
    ['en-US', 'en'],
    ['ko', 'ko'],
    ['zh-Hant', null],
    [undefined, null],
  ])('%s → %s', (code, lang) => expect(langHint(code)).toBe(lang))
})

describe('checkVideo', () => {
  const item = (duration: string, live = 'none') => ({
    snippet: { title: 't', channelTitle: 'c', liveBroadcastContent: live, defaultAudioLanguage: 'ko' },
    contentDetails: { duration },
  })

  it('accepts exactly 6 minutes', () => {
    expect(checkVideo('id', item('PT6M'))).toEqual({
      ok: true,
      id: 'id',
      title: 't',
      channel: 'c',
      durationSec: 360,
      langHint: 'ko',
    })
  })
  it('rejects over 6 minutes', () =>
    expect(checkVideo('id', item('PT6M1S'))).toMatchObject({ ok: false, reason: 'too_long' }))
  it('rejects live streams', () =>
    expect(checkVideo('id', item('P0D', 'live'))).toMatchObject({ ok: false, reason: 'live' }))
  it('rejects missing video', () =>
    expect(checkVideo('id', undefined)).toMatchObject({ ok: false, reason: 'not_found' }))
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkVideo, formatDuration } from './videoCheck'

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))
}

afterEach(() => vi.unstubAllGlobals())

describe('checkVideo', () => {
  it('ok', async () => {
    mockFetch(200, { ok: true, title: 't', durationSec: 200 })
    expect(await checkVideo('M7lc1UVf-VE')).toEqual({ status: 'ok', title: 't', durationSec: 200 })
  })

  it('too long shows the current length', async () => {
    mockFetch(200, { ok: false, reason: 'too_long', durationSec: 405 })
    const r = await checkVideo('M7lc1UVf-VE')
    expect(r.status).toBe('rejected')
    expect(r.status === 'rejected' && r.message).toContain('6:45')
  })

  it('no API key → unknown (fallback to player)', async () => {
    mockFetch(503, { error: 'no_api_key' })
    expect(await checkVideo('M7lc1UVf-VE')).toEqual({ status: 'unknown' })
  })
})

it('formatDuration', () => {
  expect(formatDuration(360)).toBe('6:00')
  expect(formatDuration(65.4)).toBe('1:05')
})

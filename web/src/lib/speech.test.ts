import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickVoice, speak, speakSequence, spokenForm } from './speech'

const voice = (lang: string, localService = true, name = lang) =>
  ({ lang, localService, name }) as SpeechSynthesisVoice

describe('pickVoice', () => {
  it('prefers an exact local voice', () => {
    const vs = [voice('ja-JP', false, 'remote'), voice('ja-JP', true, 'local'), voice('en-US')]
    expect(pickVoice(vs, 'ja')?.name).toBe('local')
  })
  it('falls back to the base language', () => {
    expect(pickVoice([voice('ko_KR')], 'ko')?.lang).toBe('ko_KR')
  })
  it('returns null when missing', () => {
    expect(pickVoice([voice('en-US')], 'ko')).toBeNull()
  })
})

describe('spokenForm', () => {
  it('uses kana for Japanese', () => {
    expect(spokenForm({ text: '光る', reading: 'ひかる' }, 'ja')).toBe('ひかる')
    expect(spokenForm({ text: '같이', reading: '가치' }, 'ko')).toBe('같이')
  })
})

describe('speech queue', () => {
  const spoken: { text: string; lang: string; rate: number }[] = []

  beforeEach(() => {
    spoken.length = 0
    class FakeUtterance {
      text: string
      lang = ''
      rate = 1
      voice: SpeechSynthesisVoice | null = null
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(t: string) {
        this.text = t
      }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [voice('ja-JP')],
      cancel: vi.fn(),
      speak: (u: FakeUtterance) => {
        spoken.push({ text: u.text, lang: u.lang, rate: u.rate })
        setTimeout(() => u.onend?.(), 0)
      },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('speak resolves after the utterance ends', async () => {
    await speak('ほし', 'ja', 0.8)
    expect(spoken).toEqual([{ text: 'ほし', lang: 'ja-JP', rate: 0.8 }])
  })

  it('speakSequence reports each item then -1', async () => {
    const seen: number[] = []
    await new Promise<void>((done) => {
      speakSequence([{ text: 'a' }, { text: 'b', rate: 0.7 }], 'ja', (i) => {
        seen.push(i)
        if (i === -1) done()
      }, 0)
    })
    expect(seen).toEqual([0, 1, -1])
    expect(spoken.map((s) => s.text)).toEqual(['a', 'b'])
    expect(spoken[1].rate).toBe(0.7)
  })

  it('cancel stops the rest', async () => {
    const seen: number[] = []
    const cancel = speakSequence([{ text: 'a' }, { text: 'b' }], 'ja', (i) => seen.push(i), 0)
    cancel()
    await new Promise((r) => setTimeout(r, 20))
    expect(seen).toEqual([0])
  })
})

// Text-to-speech with the browser's built-in voices (Web Speech API).
// Free and instant; quality depends on the device. Server TTS can replace this later.
import type { Lang } from './samples'

export const SPEECH_LANG: Record<Lang, string> = { ja: 'ja-JP', en: 'en-US', ko: 'ko-KR' }

function synth(): SpeechSynthesis | null {
  const g = globalThis as { speechSynthesis?: SpeechSynthesis }
  return g.speechSynthesis ?? null
}

export function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice | null {
  const code = SPEECH_LANG[lang]
  const base = code.split('-')[0]
  return (
    voices.find((v) => v.lang === code && v.localService) ??
    voices.find((v) => v.lang === code) ??
    voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(base)) ??
    null
  )
}

export function hasVoice(lang: Lang): boolean {
  const s = synth()
  return !!s && pickVoice(s.getVoices(), lang) !== null
}

export function stopSpeaking(): void {
  synth()?.cancel()
}

/** Speak one utterance; resolves when it ends (or immediately if speech is unavailable). */
export function speak(text: string, lang: Lang, rate = 1): Promise<void> {
  const s = synth()
  if (!s || !text.trim()) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = SPEECH_LANG[lang]
    const voice = pickVoice(s.getVoices(), lang)
    if (voice) u.voice = voice
    u.rate = rate
    u.onend = () => resolve()
    u.onerror = () => resolve()
    s.speak(u)
  })
}

/**
 * Speak items one after another. `onItem(i)` fires as each starts (-1 when done).
 * Returns a cancel function; cancelling stops the current utterance and the rest.
 */
export function speakSequence(
  items: { text: string; rate?: number }[],
  lang: Lang,
  onItem: (i: number) => void,
  gapMs = 250,
): () => void {
  let cancelled = false
  stopSpeaking()
  ;(async () => {
    for (let i = 0; i < items.length && !cancelled; i++) {
      onItem(i)
      await speak(items[i].text, lang, items[i].rate ?? 1)
      if (gapMs && !cancelled) await new Promise((r) => setTimeout(r, gapMs))
    }
    if (!cancelled) onItem(-1)
  })()
  return () => {
    cancelled = true
    stopSpeaking()
  }
}

/** What to say for a word: Japanese uses the kana reading so kanji are not misread. */
export function spokenForm(word: { text: string; reading?: string }, lang: Lang): string {
  return lang === 'ja' && word.reading ? word.reading : word.text
}

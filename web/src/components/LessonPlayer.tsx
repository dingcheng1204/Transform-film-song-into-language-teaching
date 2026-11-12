import { useCallback, useEffect, useRef, useState } from 'react'
import { activeWordIndex, currentIndex, tick } from '../lib/segments'
import { hasVoice, speak, speakSequence, spokenForm, stopSpeaking } from '../lib/speech'
import { PlayerState, playerErrorMessage, useYouTubePlayer } from '../lib/useYouTubePlayer'
import type { Timeline } from '../types/timeline'
import LessonCard from './LessonCard'
import LyricLine from './LyricLine'
import WordDetail from './WordDetail'

const POLL_MS = 50
const AUTO_SECONDS = 5

type Mode = 'watch' | 'lesson' | 'done'
type WordRef = { line: number; word: number }

// Plays the embedded video, pauses after each 1–2-line segment, shows the lesson card.
export default function LessonPlayer({ timeline }: { timeline: Timeline }) {
  const { song, segments } = timeline
  const [mode, setMode] = useState<Mode>('watch')
  // Pressing play inside the iframe during a lesson just resumes watching.
  const { containerRef, playerRef, ready, state, error } = useYouTubePlayer(song.youtubeId, (s) => {
    if (s === PlayerState.PLAYING) setMode((m) => (m === 'lesson' ? 'watch' : m))
    if (s === PlayerState.ENDED) setMode('done')
  })

  const [lessonIdx, setLessonIdx] = useState(0)
  const [t, setT] = useState(0)
  const [autoMode, setAutoMode] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const lastPaused = useRef(-1)
  const prevT = useRef(0)

  // Word study (lesson mode): tap a word, or let it read word by word / slowly.
  const lang = song.sourceLang
  const [selected, setSelected] = useState<WordRef | null>(null)
  const [speakingWord, setSpeakingWord] = useState<WordRef | null>(null)
  const [speaking, setSpeaking] = useState<'words' | 'slow' | null>(null)
  const [canSpeak, setCanSpeak] = useState(() => hasVoice(lang))
  const cancelSpeech = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Voices load asynchronously in most browsers.
    const s = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!s) return
    const update = () => setCanSpeak(hasVoice(lang))
    s.addEventListener?.('voiceschanged', update)
    const id = window.setTimeout(update, 500)
    return () => {
      s.removeEventListener?.('voiceschanged', update)
      window.clearTimeout(id)
      stopSpeaking()
    }
  }, [lang])

  const stopSpeech = useCallback(() => {
    cancelSpeech.current?.()
    cancelSpeech.current = null
    stopSpeaking()
    setSpeaking(null)
    setSpeakingWord(null)
  }, [])

  // Poll currentTime while playing; pause when a segment end is crossed.
  useEffect(() => {
    if (!ready || state !== PlayerState.PLAYING) return
    const id = window.setInterval(() => {
      const p = playerRef.current
      if (!p) return
      const now = p.getCurrentTime()
      const r = tick(segments, now, prevT.current, lastPaused.current)
      lastPaused.current = r.lastPaused
      prevT.current = now
      setT(now)
      if (r.pauseIdx !== null) {
        p.pauseVideo()
        setLessonIdx(r.pauseIdx)
        setCountdown(AUTO_SECONDS)
        setMode('lesson')
      }
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [ready, state, segments, playerRef])

  const play = useCallback(() => {
    stopSpeech()
    setSelected(null)
    setMode('watch')
    playerRef.current?.playVideo()
  }, [playerRef, stopSpeech])

  const replay = useCallback(
    (i: number) => {
      const p = playerRef.current
      if (!p) return
      const start = segments[i].start
      lastPaused.current = i - 1
      prevT.current = start
      setT(start)
      p.seekTo(start, true)
      play()
    },
    [segments, playerRef, play],
  )

  // Auto-continue countdown (paused while the learner is studying words).
  const autoActive = mode === 'lesson' && autoMode && !speaking && !selected
  useEffect(() => {
    if (!autoActive) return
    let left = AUTO_SECONDS
    const id = window.setInterval(() => {
      left -= 1
      if (left <= 0) {
        window.clearInterval(id)
        play()
      } else setCountdown(left)
    }, 1000)
    return () => window.clearInterval(id)
  }, [autoActive, lessonIdx, play])

  const shownIdx = mode === 'lesson' ? lessonIdx : currentIndex(segments, t)
  const shown = segments[shownIdx]

  function onWordClick(line: number, word: number) {
    stopSpeech()
    setSelected({ line, word })
    void speak(spokenForm(shown.lines[line].words[word], lang), lang, 0.9)
  }

  function speakWords() {
    stopSpeech()
    setSelected(null)
    const refs: (WordRef | null)[] = []
    const items: { text: string; rate?: number }[] = []
    shown.lines.forEach((ln, li) => {
      ln.words.forEach((w, wi) => {
        refs.push({ line: li, word: wi })
        items.push({ text: spokenForm(w, lang), rate: 0.85 })
      })
      refs.push(null) // then the whole line at a natural pace
      items.push({ text: ln.text, rate: 0.9 })
    })
    setSpeaking('words')
    cancelSpeech.current = speakSequence(items, lang, (i) => {
      if (i === -1) {
        setSpeaking(null)
        setSpeakingWord(null)
      } else setSpeakingWord(refs[i])
    })
  }

  function speakSlow() {
    stopSpeech()
    setSelected(null)
    setSpeaking('slow')
    cancelSpeech.current = speakSequence(
      shown.lines.map((ln) => ({ text: ln.text, rate: 0.7 })),
      lang,
      (i) => i === -1 && setSpeaking(null),
      400,
    )
  }

  // Keyboard: Space = continue / play-pause, R = replay the shown segment.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, button')) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (mode === 'lesson' || state !== PlayerState.PLAYING) play()
        else playerRef.current?.pauseVideo()
      } else if (e.key === 'r' || e.key === 'R') {
        replay(shownIdx)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, state, play, replay, shownIdx, playerRef])

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-6">
        <div className="aspect-video overflow-hidden rounded-lg bg-ink/90" ref={containerRef} />
        {error !== null && <p className="text-alert">{playerErrorMessage(error)}</p>}

        <div className="min-h-40 space-y-5" aria-live="polite">
          {shown.lines.map((line, i) => (
            <LyricLine
              key={`${shownIdx}-${i}`}
              line={line}
              lang={lang}
              activeWord={
                mode === 'watch'
                  ? activeWordIndex(line.words, t)
                  : speakingWord?.line === i
                    ? speakingWord.word
                    : -1
              }
              selectedWord={selected?.line === i ? selected.word : -1}
              onWordClick={mode === 'lesson' ? (w) => onWordClick(i, w) : undefined}
            />
          ))}
        </div>

        {mode === 'lesson' && selected && shown.lines[selected.line]?.words[selected.word] && (
          <WordDetail
            word={shown.lines[selected.line].words[selected.word]}
            lang={lang}
            onSpeak={() => onWordClick(selected.line, selected.word)}
            onClose={() => setSelected(null)}
          />
        )}

        {mode === 'lesson' && (
          <LessonCard
            segment={segments[lessonIdx]}
            isLast={lessonIdx === segments.length - 1}
            autoMode={autoMode}
            countdown={autoActive ? countdown : null}
            lang={lang}
            onSpeakText={(text) => {
              stopSpeech()
              void speak(text, lang, 0.9)
            }}
            speaking={speaking}
            canSpeak={canSpeak}
            onSpeakWords={speakWords}
            onSpeakSlow={speakSlow}
            onStopSpeaking={stopSpeech}
            onReplay={() => replay(lessonIdx)}
            onContinue={play}
            onToggleAuto={() => {
              setCountdown(AUTO_SECONDS)
              setAutoMode((a) => !a)
            }}
          />
        )}
        {mode === 'watch' && ready && state !== PlayerState.PLAYING && (
          <button
            type="button"
            onClick={play}
            className="rounded-md bg-ink px-5 py-2.5 font-medium text-white hover:bg-ink-soft"
          >
            {t === 0 ? '開始播放' : '繼續播放'}
          </button>
        )}
        {mode === 'done' && (
          <div className="flex items-center gap-4">
            <p className="text-ink-soft">整首歌練完了。</p>
            <button type="button" onClick={() => replay(0)} className="rounded-md border border-ink px-4 py-2">
              從頭再練一次
            </button>
          </div>
        )}
      </div>

      <nav aria-label="段落" className="lg:sticky lg:top-6 lg:self-start">
        <h2 className="mb-3 text-sm font-bold">段落</h2>
        <ol className="space-y-1">
          {segments.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => replay(i)}
                aria-current={i === shownIdx ? 'step' : undefined}
                className={`flex w-full gap-3 rounded-md px-2 py-1.5 text-left text-sm ${
                  i === shownIdx ? 'bg-sheet font-medium text-ink shadow-[inset_3px_0_0_var(--color-ink)]' : 'text-ink-soft hover:bg-sheet'
                }`}
              >
                <span className="w-5 shrink-0 tabular-nums text-muted">{i + 1}</span>
                <span className="truncate" lang={song.sourceLang}>
                  {s.lines.map((l) => l.text).join(' / ')}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  )
}

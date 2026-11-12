import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../lib/auth'
import { checkDictation, type DictationResult } from '../lib/dictation'
import { useRecorder } from '../lib/recorder'
import { savedKey, useSavedForSong, useToggleSaved, type NewSavedItem } from '../lib/savedApi'
import { activeWordIndex, currentIndex, tick } from '../lib/segments'
import { hasVoice, speak, speakSequence, spokenForm, stopSpeaking } from '../lib/speech'
import { PlayerState, playerErrorMessage, useYouTubePlayer } from '../lib/useYouTubePlayer'
import type { Line, Segment, Timeline, Word } from '../types/timeline'
import LessonCard from './LessonCard'
import LyricLine from './LyricLine'
import PracticePanel, { type Practice } from './PracticePanel'
import WordDetail from './WordDetail'

const POLL_MS = 50
/** Replays start this much earlier, muted, so audio is flowing when the segment begins. */
const PREROLL_SEC = 0.5
const AUTO_SECONDS = 5

type Mode = 'watch' | 'lesson' | 'done'
type WordRef = { line: number; word: number }

// Plays the embedded video, pauses after each 1–2-line segment, shows the lesson card.
export default function LessonPlayer({ timeline }: { timeline: Timeline }) {
  const { song, segments } = timeline
  // The lesson card is shown from the first play on and always follows the segment being
  // played: locked while it plays, unlocked when playback pauses at (or before) its end.
  const [mode, setModeState] = useState<Mode>('watch')
  const modeRef = useRef<Mode>('watch')
  const setMode = (m: Mode) => {
    modeRef.current = m
    setModeState(m)
  }
  const [started, setStarted] = useState(false)
  const { containerRef, playerRef, ready, state, error } = useYouTubePlayer(song.youtubeId, (s) => {
    // Pressing play inside the iframe during a lesson just resumes watching.
    if (s === PlayerState.PLAYING) {
      setStarted(true)
      if (modeRef.current === 'lesson') setMode('watch')
    }
    // Paused mid-segment (Space or the iframe's own button): study the segment being played.
    if (s === PlayerState.PAUSED && modeRef.current === 'watch') {
      const now = playerRef.current?.getCurrentTime() ?? 0
      const pr = preroll.current
      endPreroll()
      setT(now)
      openLesson(pr ? pr.idx : currentIndex(segments, now))
    }
    if (s === PlayerState.ENDED) setMode('done')
  })

  const [lessonIdx, setLessonIdx] = useState(0)
  const [t, setT] = useState(0)
  const [autoMode, setAutoMode] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const lastPaused = useRef(-1)
  const prevT = useRef(0)
  const lessonIdxRef = useRef(0)

  // Muted lead-in before a replayed segment (see PREROLL_SEC).
  const preroll = useRef<{ until: number; idx: number; muted: boolean } | null>(null)
  const [prerollIdx, setPrerollIdx] = useState<number | null>(null)
  function endPreroll() {
    const pr = preroll.current
    if (!pr) return
    if (pr.muted) playerRef.current?.unMute?.()
    preroll.current = null
    setPrerollIdx(null)
  }

  /** Switch to the (unlocked) lesson card for segment `idx`. */
  function openLesson(idx: number) {
    if (idx !== lessonIdxRef.current) {
      // New segment: start its practice fresh.
      setDictAnswer('')
      setDictResults(null)
    }
    lessonIdxRef.current = idx
    setLessonIdx(idx)
    setCountdown(AUTO_SECONDS)
    setMode('lesson')
  }

  // Dictation / shadowing state lives here so it survives replaying the segment.
  const [practice, setPractice] = useState<Practice>(null)
  const [dictAnswer, setDictAnswer] = useState('')
  const [dictResults, setDictResults] = useState<DictationResult[] | null>(null)
  const recorder = useRecorder()
  const compareTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (compareTimer.current) window.clearTimeout(compareTimer.current)
  }, [])

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

  // Saving words/lines for review (requires sign-in).
  const { user, available: canSave } = useAuth()
  const saved = useSavedForSong(song.youtubeId, lang)
  const toggleSaved = useToggleSaved()
  const navigate = useNavigate()
  const location = useLocation()
  const isSaved = (item: NewSavedItem) => !!saved.data?.has(savedKey(item.kind, item.text))
  function toggleSave(item: NewSavedItem) {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    toggleSaved.mutate({ item, savedId: saved.data?.get(savedKey(item.kind, item.text)) })
  }

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
      if (preroll.current && now >= preroll.current.until - 0.05) endPreroll()
      const r = tick(segments, now, prevT.current, lastPaused.current)
      lastPaused.current = r.lastPaused
      prevT.current = now
      setT(now)
      if (r.pauseIdx !== null) {
        openLesson(r.pauseIdx) // mode becomes 'lesson' before the PAUSED event arrives
        p.pauseVideo()
      }
    }, POLL_MS)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, state, segments, playerRef])

  const play = useCallback(
    (opts: { keepPractice?: boolean } = {}) => {
      stopSpeech()
      setSelected(null)
      if (!opts.keepPractice) {
        // Moving on: the next segment's practice starts empty.
        setDictAnswer('')
        setDictResults(null)
      }
      setStarted(true)
      setMode('watch')
      playerRef.current?.playVideo()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playerRef, stopSpeech],
  )

  const replay = useCallback(
    (i: number) => {
      const p = playerRef.current
      if (!p) return
      const start = segments[i].start
      // Start a little earlier and muted: right after a seek YouTube's audio takes a moment
      // to come out, which would otherwise swallow the first word.
      const from = Math.max(0, start - PREROLL_SEC)
      endPreroll()
      let muted = false
      if (from < start && p.mute && p.isMuted && !p.isMuted()) {
        p.mute()
        muted = true
      }
      if (from < start) {
        preroll.current = { until: start, idx: i, muted }
        setPrerollIdx(i)
      }
      lastPaused.current = i - 1
      prevT.current = from
      setT(from)
      p.seekTo(from, true)
      play({ keepPractice: i === lessonIdxRef.current })
    },
    // endPreroll only touches refs and state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments, playerRef, play],
  )

  // Auto-continue countdown (paused while the learner is studying words).
  const autoActive = mode === 'lesson' && autoMode && !speaking && !selected && !practice
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

  const shownIdx = mode === 'lesson' ? lessonIdx : (prerollIdx ?? currentIndex(segments, t))
  const shown = segments[shownIdx]
  const hideLyrics = practice === 'dictation' && !dictResults

  const lessonSeg = segments[shownIdx]
  const segSeconds = lessonSeg.end - lessonSeg.start
  function playMine() {
    if (recorder.url) void new Audio(recorder.url).play()
  }

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

  const practicePanel = (
    <PracticePanel
      practice={practice}
      onPractice={(pr) => {
        stopSpeech()
        setSelected(null)
        setPractice(pr)
      }}
      lang={lang}
      answer={dictAnswer}
      onAnswer={setDictAnswer}
      results={dictResults}
      onCheck={() => {
        const reading = (ln: Line) =>
          lang === 'ja' && ln.words.some((w) => w.reading)
            ? ln.words.map((w) => w.reading ?? w.text).join('')
            : undefined
        // Compare the whole answer against the segment's lines joined.
        const text = lessonSeg.lines.map((ln) => ln.text).join(lang === 'ja' ? '' : ' ')
        const read = lessonSeg.lines.every((ln) => reading(ln))
          ? lessonSeg.lines.map((ln) => reading(ln)).join('')
          : undefined
        setDictResults([checkDictation({ text, reading: read }, dictAnswer, lang)])
      }}
      onRetry={() => {
        setDictAnswer('')
        setDictResults(null)
      }}
      recorder={recorder.state}
      hasRecording={!!recorder.url}
      onRecord={() => recorder.start((segSeconds + 1.5) * 1000)}
      onRecordWithSong={() => {
        void recorder.start((segSeconds + 1.5) * 1000)
        replay(shownIdx)
      }}
      onStopRecording={recorder.stop}
      onPlayMine={playMine}
      onCompare={() => {
        replay(shownIdx)
        if (compareTimer.current) window.clearTimeout(compareTimer.current)
        compareTimer.current = window.setTimeout(playMine, (segSeconds + 0.6) * 1000)
      }}
      onReplay={() => replay(shownIdx)}
    />
  )

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-6">
        <div className="aspect-video overflow-hidden rounded-lg bg-ink/90" ref={containerRef} />
        {error !== null && <p className="text-alert">{playerErrorMessage(error)}</p>}

        <div className="min-h-40 space-y-5" aria-live="polite">
          {hideLyrics && <p className="pt-6 text-lg text-muted">聽寫中，歌詞先藏起來。</p>}
          {!hideLyrics && shown.lines.map((line, i) => (
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

        {mode === 'lesson' && !hideLyrics && selected && shown.lines[selected.line]?.words[selected.word] && (
          <WordDetail
            word={shown.lines[selected.line].words[selected.word]}
            lang={lang}
            saved={canSave ? isSaved(wordItem(song.youtubeId, lang, shown, selected.line, selected.word)) : undefined}
            onToggleSave={
              canSave
                ? () => toggleSave(wordItem(song.youtubeId, lang, shown, selected.line, selected.word))
                : undefined
            }
            onSpeak={() => onWordClick(selected.line, selected.word)}
            onClose={() => setSelected(null)}
          />
        )}

        {(mode === 'lesson' || (mode === 'watch' && started)) && (
          <LessonCard
            locked={mode === 'watch'}
            segment={segments[shownIdx]}
            isLast={shownIdx === segments.length - 1}
            autoMode={autoMode}
            countdown={autoActive ? countdown : null}
            lang={lang}
            savedLines={
              canSave
                ? segments[shownIdx].lines.map((_, i) => isSaved(lineItem(song.youtubeId, lang, segments[shownIdx], i)))
                : undefined
            }
            onToggleSaveLine={
              canSave ? (i) => toggleSave(lineItem(song.youtubeId, lang, segments[shownIdx], i)) : undefined
            }
            onSpeakText={(text) => {
              stopSpeech()
              void speak(text, lang, 0.9)
            }}
            speaking={speaking}
            canSpeak={canSpeak}
            onSpeakWords={speakWords}
            onSpeakSlow={speakSlow}
            onStopSpeaking={stopSpeech}
            onReplay={() => replay(shownIdx)}
            onStop={() => playerRef.current?.pauseVideo()}
            onContinue={() => play()}
            onToggleAuto={() => {
              setCountdown(AUTO_SECONDS)
              setAutoMode((a) => !a)
            }}
          >
            {practicePanel}
          </LessonCard>
        )}
        {mode === 'watch' && ready && state !== PlayerState.PLAYING && (
          <button
            type="button"
            onClick={() => play()}
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

type SongLang = Timeline['song']['sourceLang']

function joinField(words: Word[], field: 'reading' | 'romanization', lang: SongLang): string | null {
  if (!words.some((w) => w[field])) return null
  const sep = lang === 'ja' && field === 'reading' ? '' : ' '
  return words.map((w) => w[field] ?? w.text).join(sep)
}

function lineItem(youtubeId: string, lang: SongLang, seg: Segment, i: number): NewSavedItem {
  const line: Line = seg.lines[i]
  return {
    kind: 'line',
    youtube_id: youtubeId,
    source_lang: lang,
    segment_id: seg.id,
    text: line.text,
    reading: lang === 'en' ? null : joinField(line.words, 'reading', lang),
    romanization: joinField(line.words, 'romanization', lang),
    meaning: line.translation || null,
    start_sec: line.start,
    end_sec: line.end,
  }
}

function wordItem(youtubeId: string, lang: SongLang, seg: Segment, li: number, wi: number): NewSavedItem {
  const line = seg.lines[li]
  const w = line.words[wi]
  return {
    kind: 'word',
    youtube_id: youtubeId,
    source_lang: lang,
    segment_id: seg.id,
    text: w.text,
    reading: w.reading ?? null,
    romanization: w.romanization ?? null,
    meaning: w.meaning ?? null,
    context: line.text,
    start_sec: line.start, // play the whole line for context
    end_sec: line.end,
  }
}

// Microphone recording for shadowing. Audio stays in the browser (blob URL); nothing is uploaded.
import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'denied' | 'unsupported'

export function useRecorder() {
  const [state, setState] = useState<RecorderState>(() =>
    typeof navigator !== 'undefined' && navigator.mediaDevices && typeof MediaRecorder !== 'undefined'
      ? 'idle'
      : 'unsupported',
  )
  const [url, setUrl] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const timer = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const start = useCallback(
    async (maxMs: number) => {
      if (state === 'unsupported' || state === 'recording') return
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        setState('denied')
        return
      }
      const chunks: Blob[] = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return URL.createObjectURL(blob)
        })
        setState('idle')
      }
      recorder.current = rec
      rec.start()
      setState('recording')
      timer.current = window.setTimeout(stop, maxMs)
    },
    [state, stop],
  )

  const clear = useCallback(() => {
    stop()
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
  }, [stop])

  useEffect(() => () => stop(), [stop])

  return { state, url, start, stop, clear }
}

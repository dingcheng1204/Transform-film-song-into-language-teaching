import { useEffect, useRef, useState } from 'react'
import { PlayerState, useYouTubePlayer } from '../lib/useYouTubePlayer'

interface Props {
  youtubeId: string
  start: number
  end: number
  label?: string
}

// Small embedded player that plays only [start, end) of the original video.
export default function ClipPlayer({ youtubeId, start, end, label = '聽原唱' }: Props) {
  const { containerRef, playerRef, ready, state } = useYouTubePlayer(youtubeId)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!playing || state !== PlayerState.PLAYING) return
    timer.current = window.setInterval(() => {
      const p = playerRef.current
      if (p && p.getCurrentTime() >= end) {
        p.pauseVideo()
        setPlaying(false)
      }
    }, 50)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [playing, state, end, playerRef])

  function play() {
    const p = playerRef.current
    if (!p) return
    p.seekTo(Math.max(0, start - 0.1), true)
    p.playVideo()
    setPlaying(true)
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="aspect-video w-full max-w-xs overflow-hidden rounded-md bg-ink/90" />
      <button
        type="button"
        onClick={play}
        disabled={!ready}
        className="rounded-md border border-ink px-3 py-1 text-sm hover:bg-paper disabled:opacity-50"
      >
        {playing ? '播放中…' : label}
      </button>
    </div>
  )
}

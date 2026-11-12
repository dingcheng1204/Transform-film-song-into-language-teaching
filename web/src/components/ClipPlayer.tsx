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
  const mutedLeadIn = useRef(false)

  useEffect(() => {
    if (!playing || state !== PlayerState.PLAYING) return
    timer.current = window.setInterval(() => {
      const p = playerRef.current
      if (!p) return
      const now = p.getCurrentTime()
      if (mutedLeadIn.current && now >= start - 0.05) {
        p.unMute?.()
        mutedLeadIn.current = false
      }
      if (now >= end) {
        p.pauseVideo()
        setPlaying(false)
      }
    }, 50)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [playing, state, start, end, playerRef])

  function play() {
    const p = playerRef.current
    if (!p) return
    // Muted 1.5 s lead-in so the first word isn't lost while audio starts after the seek.
    const from = Math.max(0, start - 1.5)
    if (from < start && p.mute && p.isMuted && !p.isMuted()) {
      p.mute()
      mutedLeadIn.current = true
    }
    p.seekTo(from, true)
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

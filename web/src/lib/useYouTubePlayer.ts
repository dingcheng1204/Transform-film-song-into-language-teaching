// Minimal wrapper around the YouTube IFrame Player API.
// https://developers.google.com/youtube/iframe_api_reference
import { useEffect, useRef, useState } from 'react'

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  mute?(): void
  unMute?(): void
  isMuted?(): boolean
  destroy(): void
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      width?: string | number
      height?: string | number
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: () => void
        onStateChange?: (e: { data: number }) => void
        onError?: (e: { data: number }) => void
      }
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

export const PlayerState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }

let apiPromise: Promise<YTNamespace> | null = null

function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT!)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  })
  return apiPromise
}

/** Error codes from onError: 2 bad id, 5 HTML5 error, 100 not found, 101/150 embedding disabled. */
export function playerErrorMessage(code: number): string {
  if (code === 100) return '找不到這部影片，或影片已設為私人。'
  if (code === 101 || code === 150) return '影片擁有者不允許嵌入播放。'
  if (code === 2) return '影片 ID 無效。'
  return '播放器發生錯誤。'
}

export function useYouTubePlayer(videoId: string, onStateChange?: (state: number) => void) {
  const onStateChangeRef = useRef(onStateChange)
  useEffect(() => {
    onStateChangeRef.current = onStateChange
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<number>(PlayerState.UNSTARTED)
  const [error, setError] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const host = containerRef.current
    if (!host) return
    // The API replaces the target element with an iframe, so give it a child to replace.
    const target = document.createElement('div')
    host.appendChild(target)

    loadApi().then((YT) => {
      if (cancelled) return
      playerRef.current = new YT.Player(target, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => !cancelled && setReady(true),
          onStateChange: (e) => {
            if (cancelled) return
            setState(e.data)
            onStateChangeRef.current?.(e.data)
          },
          onError: (e) => !cancelled && setError(e.data),
        },
      })
    })

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
      host.replaceChildren()
      setReady(false)
      setState(PlayerState.UNSTARTED)
      setError(null)
    }
  }, [videoId])

  return { containerRef, playerRef, ready, state, error }
}

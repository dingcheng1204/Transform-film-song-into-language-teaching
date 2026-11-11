import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { playerErrorMessage, useYouTubePlayer } from '../lib/useYouTubePlayer'
import { checkVideo, formatDuration, type VideoCheckResult } from '../lib/videoCheck'
import { MAX_DURATION_SEC } from '../lib/youtube'

// P1: any video → embed + duration check. P2 adds processing and loads its real timeline.
export default function LessonPage() {
  const { youtubeId = '' } = useParams()
  const { containerRef, playerRef, ready, error } = useYouTubePlayer(youtubeId)
  const [server, setServer] = useState<VideoCheckResult | null>(null)
  const [playerDuration, setPlayerDuration] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    checkVideo(youtubeId).then((r) => live && setServer(r))
    return () => {
      live = false
    }
  }, [youtubeId])

  // Fallback when the server can't check: the player knows the duration once ready.
  useEffect(() => {
    if (ready) setPlayerDuration(playerRef.current?.getDuration() ?? null)
  }, [ready, playerRef])

  let verdict: { ok: boolean; text: string } | null = null
  if (server?.status === 'rejected') verdict = { ok: false, text: server.message }
  else if (server?.status === 'ok')
    verdict = { ok: true, text: `長度 ${formatDuration(server.durationSec ?? 0)}，可以處理。` }
  else if (server?.status === 'unknown' && playerDuration)
    verdict =
      playerDuration > MAX_DURATION_SEC
        ? { ok: false, text: `影片長度 ${formatDuration(playerDuration)}，超過 6 分鐘，請換一首比較短的歌。` }
        : { ok: true, text: `長度 ${formatDuration(playerDuration)}，可以處理。` }

  return (
    <div className="space-y-6">
      <div className="aspect-video overflow-hidden rounded-lg bg-ink/90" ref={containerRef} />
      {error !== null && <p className="text-alert">{playerErrorMessage(error)}</p>}
      {server?.status === 'ok' && server.title && <h1 className="text-xl font-bold">{server.title}</h1>}
      {verdict && <p className={verdict.ok ? 'text-ink' : 'text-alert'}>{verdict.text}</p>}
      {verdict?.ok && (
        <p className="text-ink-soft">
          自動產生逐句教學會在下一個版本加入。現在可以先看
          <Link to="/demo/ja" className="mx-1 underline">日文</Link>、
          <Link to="/demo/en" className="mx-1 underline">英文</Link>、
          <Link to="/demo/ko" className="mx-1 underline">韓文</Link>
          示範，試試暫停教學的流程。
        </p>
      )}
    </div>
  )
}

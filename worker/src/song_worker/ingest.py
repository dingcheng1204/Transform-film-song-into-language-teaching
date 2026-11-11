"""Duration gate + audio-only download with yt-dlp (audio-ingest skill)."""

from pathlib import Path
from typing import Any

from song_worker.errors import JobError

MAX_DURATION_SEC = 360
LIVE_STATES = {"is_live", "is_upcoming", "post_live"}


def watch_url(youtube_id: str) -> str:
    return f"https://www.youtube.com/watch?v={youtube_id}"


def check_metadata(info: dict[str, Any]) -> tuple[str, float]:
    """Validate yt-dlp metadata before downloading. Returns (title, duration_sec)."""
    if info.get("is_live") or info.get("live_status") in LIVE_STATES:
        raise JobError("live_stream")
    duration = info.get("duration")
    if not duration:
        raise JobError("unavailable", "no duration in metadata")
    if duration > MAX_DURATION_SEC:
        raise JobError("too_long", f"{duration}s")
    return str(info.get("title") or ""), float(duration)


def probe(youtube_id: str) -> dict[str, Any]:
    """Metadata only — nothing is downloaded."""
    import yt_dlp

    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(watch_url(youtube_id), download=False)
    except yt_dlp.utils.DownloadError as e:
        raise JobError("unavailable", str(e)) from e


def download_audio(youtube_id: str, workdir: Path) -> Path:
    """Best audio stream → 44.1 kHz stereo WAV in workdir. Never downloads video."""
    import yt_dlp

    workdir.mkdir(parents=True, exist_ok=True)
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "format": "bestaudio/best",
        "outtmpl": str(workdir / "source.%(ext)s"),
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav"}],
        "postprocessor_args": {"extractaudio": ["-ar", "44100", "-ac", "2"]},
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([watch_url(youtube_id)])
    except yt_dlp.utils.DownloadError as e:
        raise JobError("download_failed", str(e)) from e
    out = workdir / "source.wav"
    if not out.exists():
        raise JobError("download_failed", "source.wav missing after download")
    return out

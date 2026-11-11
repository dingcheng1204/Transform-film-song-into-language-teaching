"""Pipeline stages. Each stage is filled in by the phase noted in its docstring.

The worker polls song_teaching.jobs, runs these in order, and writes a Timeline
(see timeline.py, generated from the shared JSON Schema) back to Supabase.
"""

from dataclasses import dataclass
from pathlib import Path

MAX_DURATION_SEC = 360


@dataclass
class Job:
    id: str
    youtube_id: str
    source_lang: str  # "en" | "ja"
    workdir: Path


def fetch_audio(job: Job) -> Path:
    """P2 — yt-dlp audio-only download. Re-check duration <= MAX_DURATION_SEC before downloading."""
    raise NotImplementedError("p2")


def separate_vocals(audio: Path) -> Path:
    """P2 — Demucs (htdemucs) two-stem split; return vocals.wav."""
    raise NotImplementedError("p2")


def align_words(vocals: Path, lang: str) -> list[dict]:
    """P2 — WhisperX transcription + word-level alignment."""
    raise NotImplementedError("p2")


def segment_lines(words: list[dict]) -> list[dict]:
    """P2 — group words into lines, then lines into 1–2-line segments."""
    raise NotImplementedError("p2")


def annotate(segments: list[dict], lang: str) -> list[dict]:
    """P3 — translation (zh-TW), furigana/romaji (ja) or IPA (en), lessons via Claude."""
    raise NotImplementedError("p3")


def synthesize_tts(segments: list[dict], lang: str) -> list[dict]:
    """P4 — slow TTS reading per segment, upload to Storage bucket song-tts."""
    raise NotImplementedError("p4")

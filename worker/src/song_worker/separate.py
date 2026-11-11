"""Vocal separation with Demucs (htdemucs, two stems) + 16 kHz mono for WhisperX."""

import subprocess
import sys
from pathlib import Path

from song_worker.errors import JobError


def separate_vocals(audio: Path, device: str = "cpu") -> Path:
    """Return path to vocals16k.wav next to `audio`. Deletes the source audio afterwards."""
    workdir = audio.parent
    cmd = [
        sys.executable, "-m", "demucs",
        "--two-stems=vocals",
        "-n", "htdemucs",
        "-d", device,
        "-o", str(workdir / "demucs"),
        str(audio),
    ]  # fmt: skip
    r = subprocess.run(cmd, capture_output=True, text=True)
    vocals = workdir / "demucs" / "htdemucs" / audio.stem / "vocals.wav"
    if r.returncode != 0 or not vocals.exists():
        raise JobError("separation_failed", r.stderr[-2000:])

    out = workdir / "vocals16k.wav"
    r = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(vocals),
            "-ac",
            "1",
            "-ar",
            "16000",
            str(out),
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise JobError("separation_failed", "ffmpeg resample: " + r.stderr[-1000:])

    audio.unlink(missing_ok=True)  # keep only what the next stage needs
    return out

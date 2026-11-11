"""Run the stages for one job. Stages are injectable so the flow is testable without
yt-dlp / Demucs / WhisperX installed.

Progress ranges: probe 0–5, download 5–15, separate 15–45, align 45–90, build 90–100.
P3 (annotate) and P4 (tts) slot in before build.
"""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from song_worker.build import build_timeline
from song_worker.ingest import check_metadata
from song_worker.ja_tokens import Tokenizer, merge_chars
from song_worker.segment import RawWord, fill_missing_times, to_lines, to_segments
from song_worker.timeline import Timeline

Report = Callable[[str, int], None]


@dataclass
class Stages:
    probe: Callable[[str], dict[str, Any]]
    download: Callable[[str, Path], Path]
    separate: Callable[[Path], Path]
    align: Callable[[Path, str], list[RawWord]]
    ja_tokenizer: Callable[[], Tokenizer]


def default_stages(whisper_model: str, device: str, compute_type: str, batch_size: int) -> Stages:
    from song_worker import align, ingest, ja_tokens, separate

    return Stages(
        probe=ingest.probe,
        download=ingest.download_audio,
        separate=lambda audio: separate.separate_vocals(audio, device=device),
        align=lambda vocals, lang: align.transcribe_and_align(
            vocals, lang, whisper_model, device, compute_type, batch_size
        ),
        ja_tokenizer=ja_tokens.fugashi_tokenizer,
    )


def process(youtube_id: str, lang: str, workdir: Path, stages: Stages, report: Report) -> Timeline:
    report("probe", 0)
    title, duration = check_metadata(stages.probe(youtube_id))

    report("download", 5)
    audio = stages.download(youtube_id, workdir)

    report("separate", 15)
    vocals = stages.separate(audio)

    report("align", 45)
    raw = stages.align(vocals, lang)
    if lang == "ja":
        raw = merge_chars(raw, stages.ja_tokenizer())

    report("segment", 90)
    lines = to_lines(fill_missing_times(raw), lang)
    segments = to_segments(lines)
    return build_timeline(youtube_id, title, duration, lang, segments)

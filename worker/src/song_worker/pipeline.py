"""Run the stages for one job. Stages are injectable so the flow is testable without
yt-dlp / Demucs / WhisperX installed.

Progress ranges: probe 0–5, download 5–15, separate 15–45, align 45–85, segment 85,
readings 86, translate 88, lessons 90–99. P4 (tts) slots in after lessons.
"""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from song_worker.build import build_timeline
from song_worker.ingest import check_metadata
from song_worker.ja_tokens import Tokenizer, merge_chars
from song_worker.segment import RawWord, fill_missing_times, to_lines, to_segments
from song_worker.timeline import Timeline

if TYPE_CHECKING:
    from song_worker.config import Settings

Report = Callable[[str, int], None]


@dataclass
class Stages:
    probe: Callable[[str], dict[str, Any]]
    download: Callable[[str, Path], Path]
    separate: Callable[[Path], Path]
    align: Callable[[Path, str], list[RawWord]]
    ja_tokenizer: Callable[[], Tokenizer]
    annotate: Callable[[Timeline, Report], Timeline] | None = None


def default_stages(settings: "Settings") -> Stages:
    from song_worker import align, ingest, ja_tokens, separate
    from song_worker.annotate import annotate

    whisper_model, device = settings.whisper_model, settings.device
    compute_type, batch_size = settings.compute_type, settings.batch_size
    llm = settings.make_llm()
    return Stages(
        probe=ingest.probe,
        download=ingest.download_audio,
        separate=lambda audio: separate.separate_vocals(audio, device=device),
        align=lambda vocals, lang: align.transcribe_and_align(
            vocals, lang, whisper_model, device, compute_type, batch_size
        ),
        ja_tokenizer=ja_tokens.fugashi_tokenizer,
        annotate=lambda t, report: annotate(t, llm, report, workers=settings.llm_concurrency),
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

    report("segment", 85)
    lines = to_lines(fill_missing_times(raw), lang)
    segments = to_segments(lines)
    timeline = build_timeline(youtube_id, title, duration, lang, segments)
    if stages.annotate:
        timeline = stages.annotate(timeline, report)
    return timeline

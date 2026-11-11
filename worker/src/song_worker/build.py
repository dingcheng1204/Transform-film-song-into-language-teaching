"""Assemble a schema-valid Timeline from segments. P2 leaves translation/readings/lessons
empty; P3 fills them in."""

from song_worker.segment import SegmentT, line_text
from song_worker.timeline import Lesson, Line, Segment, Song, Timeline, Word


def build_timeline(
    youtube_id: str, title: str, duration_sec: float, lang: str, segments: list[SegmentT]
) -> Timeline:
    return Timeline(
        schemaVersion="1.0",
        song=Song(
            youtubeId=youtube_id,
            title=title or youtube_id,
            durationSec=duration_sec,
            sourceLang=lang,
            targetLang="zh-TW",
        ),
        segments=[
            Segment(
                id=i,
                start=s.start,
                end=s.end,
                lines=[
                    Line(
                        text=line_text(line, lang),
                        translation="",
                        start=line.start,
                        end=line.end,
                        words=[Word(text=w.text, start=w.start, end=w.end) for w in line.words],
                    )
                    for line in s.lines
                ],
                lesson=Lesson(pronunciationNotes=[], connectedSpeech=[], singingTips=[]),
            )
            for i, s in enumerate(segments)
        ],
    )

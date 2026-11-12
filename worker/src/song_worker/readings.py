"""Per-word readings (bilingual-subs skill).

  ja: reading = hiragana (furigana), romanization = Hepburn            — pykakasi
  ko: reading = Hangul as pronounced, romanization = RR of that form   — ko_pron + korean-romanizer
  en: reading = IPA (General American, with stress)                    — phonemizer + espeak-ng

Each backend is loaded lazily; if one is missing the words are left without readings
rather than failing the whole job.
"""

import logging
from collections.abc import Callable

from song_worker.timeline import Timeline

log = logging.getLogger("song_worker")

# Particles are written は/へ/を but romanized by pronunciation (wa/e/o) in learner Hepburn.
JA_PARTICLE_ROMAJI = {"は": "wa", "へ": "e", "を": "o"}

# word text -> (reading, romanization)
Annotator = Callable[[list[str]], list[tuple[str | None, str | None]]]


def ja_annotator() -> Annotator:
    import pykakasi

    kks = pykakasi.kakasi()

    def run(words: list[str]) -> list[tuple[str | None, str | None]]:
        out = []
        for w in words:
            if w in JA_PARTICLE_ROMAJI:  # Whisper/fugashi tokens: a lone は/へ/を is the particle
                out.append((w, JA_PARTICLE_ROMAJI[w]))
                continue
            parts = kks.convert(w)
            out.append(("".join(p["hira"] for p in parts), "".join(p["hepburn"] for p in parts)))
        return out

    return run


def ko_annotator() -> Annotator:
    from song_worker.ko_pron import pronounce, romanize

    def run(words: list[str]) -> list[tuple[str | None, str | None]]:
        out = []
        for w in words:
            p = pronounce(w)
            out.append((p, romanize(p)))
        return out

    return run


def en_annotator() -> Annotator:
    from phonemizer import phonemize

    def run(words: list[str]) -> list[tuple[str | None, str | None]]:
        if not words:
            return []
        ipa = phonemize(
            words, language="en-us", backend="espeak", strip=True, with_stress=True, njobs=1
        )
        return [(i or None, None) for i in ipa]

    return run


ANNOTATORS: dict[str, Callable[[], Annotator]] = {
    "ja": ja_annotator,
    "ko": ko_annotator,
    "en": en_annotator,
}


def add_readings(timeline: Timeline, annotator: Annotator | None = None) -> Timeline:
    """Fill Word.reading / Word.romanization in place and return the timeline."""
    lang = timeline.song.sourceLang.value
    if annotator is None:
        try:
            annotator = ANNOTATORS[lang]()
        except Exception as e:  # missing optional dependency / system package
            log.warning("readings for %s unavailable: %s", lang, e)
            return timeline

    words = [w for s in timeline.segments for line in s.lines for w in line.words]
    try:
        results = annotator([w.text for w in words])
    except Exception as e:
        log.warning("readings for %s failed: %s", lang, e)
        return timeline
    for w, (reading, roman) in zip(words, results, strict=True):
        w.reading = reading or None
        w.romanization = roman or None
    return timeline


def sentence_reading(text: str, lang: str) -> tuple[str | None, str | None]:
    """Whole-sentence reading for generated examples (ja kana + Hepburn, ko pronounced + RR).
    English and missing backends return (None, None)."""
    try:
        if lang == "ja":
            import pykakasi

            parts = pykakasi.kakasi().convert(text)
            hira = "".join(p["hira"] for p in parts)
            roman = " ".join(
                JA_PARTICLE_ROMAJI.get(p["orig"], p["hepburn"])
                for p in parts
                if p["hepburn"].strip()
            )
            return (hira if hira != text else None), roman or None
        if lang == "ko":
            from song_worker.ko_pron import pronounce, romanize

            eojeol = text.split()
            pron = [pronounce(e) for e in eojeol]
            return " ".join(pron), " ".join(romanize(p) for p in pron)
    except Exception as e:
        log.warning("sentence reading for %s failed: %s", lang, e)
    return None, None

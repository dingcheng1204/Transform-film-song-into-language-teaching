import json
import shutil
from pathlib import Path

import pytest

from song_worker.annotate import annotate, lesson_for_segment, translate_song
from song_worker.llm import LLMError
from song_worker.readings import add_readings
from song_worker.timeline import Timeline

EXAMPLES = Path(__file__).resolve().parents[2] / "schema" / "examples"


def bare(lang: str) -> Timeline:
    """Sample timeline stripped back to what P2 produces."""
    d = json.loads((EXAMPLES / f"sample-{lang}.timeline.json").read_text(encoding="utf-8"))
    for s in d["segments"]:
        s["lesson"] = {"pronunciationNotes": [], "connectedSpeech": [], "singingTips": []}
        for ln in s["lines"]:
            ln["translation"] = ""
            for w in ln["words"]:
                w.pop("reading", None)
                w.pop("romanization", None)
    return Timeline.model_validate(d)


class FakeLLM:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []

    def complete_json(self, system, user):
        self.calls.append((system, json.loads(user)))
        r = self.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def test_translate_maps_lines_in_order():
    t = bare("en")
    llm = FakeLLM([{"lines": [{"i": 0, "zh": "甲"}, {"i": 1, "zh": "乙"}, {"i": 2, "zh": "丙"}]}])
    translate_song(t, llm)
    assert [ln.translation for s in t.segments for ln in s.lines] == ["甲", "乙", "丙"]
    assert llm.calls[0][1]["language"] == "英文"


def test_translate_retries_when_line_count_is_wrong():
    t = bare("en")
    llm = FakeLLM(
        [{"lines": [{"i": 0, "zh": "甲"}]}, {"lines": [{"i": i, "zh": str(i)} for i in range(3)]}]
    )
    translate_song(t, llm)
    assert len(llm.calls) == 2
    assert t.segments[1].lines[0].translation == "2"


def test_lesson_limits_and_payload():
    t = bare("ko")
    llm = FakeLLM(
        [
            {
                "pronunciationNotes": ["a", "b", "c", "d"],
                "connectedSpeech": [" ", "x"],
                "singingTips": ["1", "2", "3"],
            }
        ]
    )
    lesson = lesson_for_segment(t, 0, llm)
    assert lesson.pronunciationNotes == ["a", "b", "c"]
    assert lesson.connectedSpeech == ["x"]
    assert lesson.singingTips == ["1", "2"]
    system, payload = llm.calls[0]
    assert "韓文" in system and "연음" in system
    assert payload["next"] == t.segments[1].lines[0].text
    assert payload["lines"][0]["words"][0]["sec"] == 0.8


def test_annotate_full_flow_tolerates_a_failed_segment():
    t = bare("en")
    readings = lambda words: [(f"/{w}/", None) for w in words]  # noqa: E731
    llm = FakeLLM(
        [
            {"lines": [{"i": i, "zh": f"z{i}"} for i in range(3)]},
            {"pronunciationNotes": ["n0"], "connectedSpeech": [], "singingTips": []},
            LLMError("boom"),
        ]
    )
    progress = []
    annotate(t, llm, lambda s, p: progress.append(s), annotator=readings, workers=1)
    assert t.segments[0].lines[0].words[0].reading == "/Walk/"
    assert t.segments[0].lines[0].translation == "z0"
    assert t.segments[0].lesson.pronunciationNotes == ["n0"]
    assert t.segments[1].lesson.pronunciationNotes == []  # failed segment stays empty
    assert progress[:3] == ["readings", "translate", "lessons"]
    Timeline.model_validate(t.model_dump())


def test_annotate_without_llm_only_adds_readings():
    t = bare("en")
    annotate(t, None, lambda s, p: None, annotator=lambda ws: [("r", None)] * len(ws))
    assert t.segments[0].lines[0].words[0].reading == "r"
    assert t.segments[0].lines[0].translation == ""


def test_japanese_readings_with_pykakasi():
    pytest.importorskip("pykakasi")
    t = add_readings(bare("ja"))
    w = t.segments[0].lines[0].words[2]
    assert (w.text, w.reading, w.romanization) == ("光る", "ひかる", "hikaru")


def test_korean_readings():
    pytest.importorskip("korean_romanizer")
    t = add_readings(bare("ko"))
    w = t.segments[0].lines[0].words[0]
    assert (w.text, w.reading, w.romanization) == ("같이", "가치", "gachi")


def test_english_ipa_with_espeak():
    pytest.importorskip("phonemizer")
    if not shutil.which("espeak-ng") and not shutil.which("espeak"):
        pytest.skip("espeak-ng not installed")
    t = add_readings(bare("en"))
    assert t.segments[0].lines[0].words[0].reading


def test_missing_backend_leaves_words_unchanged(monkeypatch):
    import song_worker.readings as r

    def broken():
        raise ImportError("no phonemizer")

    monkeypatch.setitem(r.ANNOTATORS, "en", broken)
    t = add_readings(bare("en"))
    assert t.segments[0].lines[0].words[0].reading is None

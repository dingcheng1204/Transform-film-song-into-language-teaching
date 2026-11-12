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
                "grammarNotes": ["g1", "g2", "g3"],
                "wordMeanings": [["一起", "要走嗎"], ["星光", "在下面"]],
            }
        ]
    )
    lesson, meanings = lesson_for_segment(t, 0, llm)
    assert lesson.grammarNotes == ["g1", "g2"]
    assert meanings == [["一起", "要走嗎"], ["星光", "在下面"]]
    assert lesson.pronunciationNotes == ["a", "b", "c"]
    assert lesson.connectedSpeech == ["x"]
    assert lesson.singingTips == ["1", "2"]
    system, payload = llm.calls[0]
    assert "韓文" in system and "연음" in system and "은/는" in system
    assert payload["next"] == t.segments[1].lines[0].text
    assert payload["lines"][0]["words"][0]["sec"] == 0.8


def test_annotate_full_flow_tolerates_a_failed_segment():
    t = bare("en")
    readings = lambda words: [(f"/{w}/", None) for w in words]  # noqa: E731
    llm = FakeLLM(
        [
            {"lines": [{"i": i, "zh": f"z{i}"} for i in range(3)]},
            {
                "pronunciationNotes": ["n0"],
                "connectedSpeech": [],
                "singingTips": [],
                "wordMeanings": [["走"] * 6, ["撐"] * 7],
            },
            LLMError("boom"),
        ]
    )
    progress = []
    annotate(t, llm, lambda s, p: progress.append(s), annotator=readings, workers=1)
    assert t.segments[0].lines[0].words[0].reading == "/Walk/"
    assert t.segments[0].lines[0].translation == "z0"
    assert t.segments[0].lesson.pronunciationNotes == ["n0"]
    assert t.segments[0].lines[1].words[0].meaning == "撐"
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
    wo = t.segments[0].lines[1].words[3]
    assert (wo.text, wo.romanization) == ("を", "o")
    he = t.segments[1].lines[0].words[1]
    assert (he.text, he.romanization) == ("へ", "e")


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


def test_mismatched_word_meanings_are_ignored():
    t = bare("en")
    llm = FakeLLM([{"pronunciationNotes": ["n"], "wordMeanings": [["only one"]]}])
    lesson, meanings = lesson_for_segment(t, 0, llm)
    assert lesson.pronunciationNotes == ["n"] and meanings is None


def test_patterns_parsed_with_local_readings():
    pytest.importorskip("pykakasi")
    t = bare("ja")
    llm = FakeLLM(
        [
            {
                "pronunciationNotes": [],
                "wordMeanings": [
                    ["夜空", "在", "閃耀的", "星星"],
                    ["你", "的", "名字", "（受詞）", "呼喚"],
                ],
                "patterns": [
                    {
                        "pattern": "〔名詞〕を呼ぶ",
                        "explanation": "呼喚某人或某物。",
                        "examples": [
                            {"text": "猫を呼ぶ", "translation": "叫貓", "swap": "名前 → 猫"},
                            {"text": "", "translation": "空的會被略過"},
                            {"text": "友達を呼ぶ", "translation": "叫朋友"},
                            {"text": "先生を呼ぶ", "translation": "叫老師"},
                            {"text": "母を呼ぶ", "translation": "第四句會被截掉"},
                        ],
                    },
                    {
                        "pattern": "第二個句型會被截掉",
                        "explanation": "",
                        "examples": [{"text": "x", "translation": "y"}],
                    },
                ],
            }
        ]
    )
    lesson, _ = lesson_for_segment(t, 0, llm)
    assert len(lesson.patterns) == 1
    p = lesson.patterns[0]
    assert p.pattern == "〔名詞〕を呼ぶ"
    assert [e.text for e in p.examples] == ["猫を呼ぶ", "友達を呼ぶ", "先生を呼ぶ"]
    assert p.examples[0].reading == "ねこをよぶ"
    assert p.examples[0].romanization == "neko o yobu"
    assert p.examples[0].swap == "名前 → 猫"
    assert p.examples[1].swap is None
    assert "〔名詞〕" in llm.calls[0][0]  # prompt asks for slot notation


def test_korean_pattern_example_reading():
    pytest.importorskip("korean_romanizer")
    t = bare("ko")
    llm = FakeLLM(
        [
            {
                "patterns": [
                    {
                        "pattern": "〔名詞〕를 좋아해",
                        "explanation": "喜歡某人或某物（半語）。",
                        "examples": [{"text": "음악을 좋아해", "translation": "我喜歡音樂"}],
                    }
                ]
            }
        ]
    )
    lesson, _ = lesson_for_segment(t, 1, llm)
    ex = lesson.patterns[0].examples[0]
    assert (ex.reading, ex.romanization) == ("으마글 조아해", "eumageul joahae")


def test_malformed_patterns_are_dropped():
    t = bare("en")
    llm = FakeLLM([{"patterns": [{"pattern": "", "examples": []}, "nope"]}])
    lesson, _ = lesson_for_segment(t, 0, llm)
    assert lesson.patterns == []


def test_retry_when_word_meanings_do_not_line_up():
    t = bare("en")
    t.segments = t.segments[:1]
    good = {"pronunciationNotes": ["second"], "wordMeanings": [["a"] * 6, ["b"] * 7]}
    llm = FakeLLM([{"pronunciationNotes": ["first"], "wordMeanings": [["x"]]}, good])
    from song_worker.annotate import add_lessons

    add_lessons(t, llm, lambda s, p: None, workers=1)
    assert len(llm.calls) == 2
    assert t.segments[0].lesson.pronunciationNotes == ["second"]
    assert t.segments[0].lines[1].words[0].meaning == "b"

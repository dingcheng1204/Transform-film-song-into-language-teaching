import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from song_worker.timeline import Timeline

EXAMPLES = Path(__file__).resolve().parents[2] / "schema" / "examples"


def load(lang: str = "en") -> dict:
    return json.loads((EXAMPLES / f"sample-{lang}.timeline.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("lang", ["en", "ja", "ko"])
def test_samples_validate(lang: str):
    t = Timeline.model_validate(load(lang))
    assert t.song.sourceLang.value == lang


def test_ko_reading_and_romanization():
    w = Timeline.model_validate(load("ko")).segments[0].lines[0].words[0]
    assert (w.text, w.reading, w.romanization) == ("같이", "가치", "gachi")


def test_rejects_over_six_minutes():
    data = load()
    data["song"]["durationSec"] = 361
    with pytest.raises(ValidationError):
        Timeline.model_validate(data)


def test_rejects_unsupported_language():
    data = load()
    data["song"]["sourceLang"] = "zh"
    with pytest.raises(ValidationError):
        Timeline.model_validate(data)


def test_rejects_three_lines():
    data = load()
    seg = data["segments"][0]
    seg["lines"].append(seg["lines"][0])
    with pytest.raises(ValidationError):
        Timeline.model_validate(data)

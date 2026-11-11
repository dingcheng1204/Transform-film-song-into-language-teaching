import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from song_worker.timeline import Timeline

SAMPLE = Path(__file__).resolve().parents[2] / "schema" / "examples" / "sample-en.timeline.json"


def load() -> dict:
    return json.loads(SAMPLE.read_text(encoding="utf-8"))


def test_sample_validates():
    t = Timeline.model_validate(load())
    assert t.segments[0].lines[0].words[0].text == "Walk"


def test_rejects_over_six_minutes():
    data = load()
    data["song"]["durationSec"] = 361
    with pytest.raises(ValidationError):
        Timeline.model_validate(data)


def test_rejects_three_lines():
    data = load()
    seg = data["segments"][0]
    seg["lines"].append(seg["lines"][0])
    with pytest.raises(ValidationError):
        Timeline.model_validate(data)

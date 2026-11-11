import pytest

from song_worker.errors import JobError
from song_worker.ingest import check_metadata


def test_ok():
    assert check_metadata({"title": "t", "duration": 245}) == ("t", 245.0)


def test_exactly_six_minutes_ok():
    assert check_metadata({"title": "t", "duration": 360})[1] == 360.0


@pytest.mark.parametrize(
    "info, code",
    [
        ({"duration": 361}, "too_long"),
        ({"duration": 100, "is_live": True}, "live_stream"),
        ({"duration": 100, "live_status": "is_upcoming"}, "live_stream"),
        ({"title": "x"}, "unavailable"),
    ],
)
def test_rejections(info, code):
    with pytest.raises(JobError) as e:
        check_metadata(info)
    assert e.value.code == code


def test_unknown_error_code_is_a_bug():
    with pytest.raises(ValueError):
        JobError("whatever")

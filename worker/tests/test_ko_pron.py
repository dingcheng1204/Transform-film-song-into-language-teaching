import pytest

from song_worker.ko_pron import pronounce


@pytest.mark.parametrize(
    "word, expected",
    [
        ("걸어갈까", "거러갈까"),  # 연음
        ("앉아", "안자"),  # double final liaison
        ("좋아해", "조아해"),  # ㅎ 탈락
        ("같이", "가치"),  # 구개음화
        ("굳이", "구지"),
        ("좋다", "조타"),  # 격음화
        ("축하", "추카"),
        ("합니다", "함니다"),  # 비음화
        ("먹는", "멍는"),
        ("신라", "실라"),  # 유음화
        ("설날", "설랄"),
        ("학교", "학꾜"),  # 경음화
        ("없어", "업써"),  # ㅄ liaison: ㅂ stays, ㅅ moves and tenses
        ("값이", "갑씨"),
        ("빛", "빋"),  # neutralization at word end
        ("꽃", "꼳"),
        ("사랑해", "사랑해"),  # no change
        ("너를", "너를"),
        ("Love", "Love"),  # non-Hangul passes through
        ("OK사랑", "OK사랑"),
    ],
)
def test_pronounce(word, expected):
    assert pronounce(word) == expected


def test_romanize_pronounced_form():
    pytest.importorskip("korean_romanizer")
    from song_worker.ko_pron import romanize

    assert romanize("가치") == "gachi"
    assert romanize("조아해") == "joahae"

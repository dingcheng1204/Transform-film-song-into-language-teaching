from song_worker.ja_tokens import merge_chars
from song_worker.segment import RawWord


def chars(text, start=0.0, step=0.2, seg=0):
    return [RawWord(c, start + i * step, start + (i + 1) * step, seg) for i, c in enumerate(text)]


def fixed(mapping):
    return lambda text: mapping[text]


def test_merges_chars_into_tokens_with_spans():
    out = merge_chars(chars("夜空に光る"), fixed({"夜空に光る": ["夜空", "に", "光る"]}))
    assert [(t.text, round(t.start, 3), round(t.end, 3)) for t in out] == [
        ("夜空", 0.0, 0.4),
        ("に", 0.4, 0.6),
        ("光る", 0.6, 1.0),
    ]


def test_drops_punctuation_tokens():
    out = merge_chars(chars("星、君"), fixed({"星、君": ["星", "、", "君"]}))
    assert [t.text for t in out] == ["星", "君"]


def test_per_segment_and_keeps_seg_index():
    cs = chars("星", seg=0) + chars("君", start=1.0, seg=1)
    out = merge_chars(cs, fixed({"星": ["星"], "君": ["君"]}))
    assert [(t.text, t.seg) for t in out] == [("星", 0), ("君", 1)]


def test_unaligned_chars_inside_token():
    cs = [RawWord("光", None, None), RawWord("る", 0.5, 0.8)]
    out = merge_chars(cs, fixed({"光る": ["光る"]}))
    assert (out[0].start, out[0].end) == (0.5, 0.8)


def test_falls_back_to_chars_when_tokens_do_not_line_up():
    out = merge_chars(chars("ab"), fixed({"ab": ["x"]}))
    assert [t.text for t in out] == ["a", "b"]

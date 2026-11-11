from song_worker.segment import (
    RawWord,
    Word,
    fill_missing_times,
    line_text,
    to_lines,
    to_segments,
)


def w(text, start, end, seg=0):
    return Word(text, start, end, seg)


def evenly(texts, start, step=0.4, seg=0):
    return [w(t, start + i * step, start + (i + 1) * step - 0.05, seg) for i, t in enumerate(texts)]


class TestFillMissing:
    def test_interpolates_between_neighbours(self):
        out = fill_missing_times(
            [RawWord("a", 1.0, 1.5), RawWord("b", None, None), RawWord("c", None, None),
             RawWord("d", 2.5, 3.0)]
        )  # fmt: skip
        assert [(x.start, x.end) for x in out] == [(1.0, 1.5), (1.5, 2.0), (2.0, 2.5), (2.5, 3.0)]

    def test_leading_and_trailing_missing(self):
        out = fill_missing_times(
            [RawWord("a", None, None), RawWord("b", 2.0, 2.4), RawWord("c", None, None)]
        )
        assert len(out) == 3
        assert out[0].end <= out[1].start + 1e-9
        assert out[2].start >= 2.4 and out[2].end > out[2].start

    def test_never_drops_words_and_end_after_start(self):
        out = fill_missing_times([RawWord(t, None, None) for t in "abc"])
        assert [x.text for x in out] == ["a", "b", "c"]
        assert all(x.end > x.start for x in out)


class TestLines:
    def test_split_on_whisper_segment_and_gap(self):
        words = evenly(["Walk", "me", "out"], 2.0) + evenly(["into", "the", "light"], 3.25, seg=0)
        words += evenly(["Hold", "on"], 6.0, seg=1)  # new whisper segment
        lines = to_lines(words, "en")
        # 3.25 - 3.15 = 0.1s gap → same line; seg change → new line
        assert [line_text(x, "en") for x in lines] == ["Walk me out into the light", "Hold on"]

    def test_gap_of_600ms_splits(self):
        words = [w("a", 0, 1), w("b", 1.6, 2)]
        assert len(to_lines(words, "en")) == 2

    def test_drops_punctuation_tokens(self):
        words = [w("夜空", 0, 1), w("、", 1, 1.05), w("星", 1.05, 2)]
        lines = to_lines(words, "ja")
        assert line_text(lines[0], "ja") == "夜空星"

    def test_long_line_split_at_largest_gap(self):
        words = evenly([f"w{i}" for i in range(10)], 0, 0.5) + evenly(
            [f"x{i}" for i in range(10)], 5.3, 0.5
        )  # 0.35s gap between halves, the largest; 20 words > 14
        lines = to_lines(words, "en")
        assert [len(x.words) for x in lines] == [10, 10]

    def test_korean_eojeol_limit(self):
        words = evenly([f"말{i}" for i in range(9)], 0, 0.6)
        assert len(to_lines(words, "ko")) == 2


class TestSegments:
    def lines(self, spans):
        return to_lines([w(f"t{i}", s, e, seg=i) for i, (s, e) in enumerate(spans)], "en")

    def test_pairs_lines_within_8s(self):
        segs = to_segments(self.lines([(2, 4.6), (4.8, 7.5), (8, 11)]))
        assert [len(s.lines) for s in segs] == [2, 1]

    def test_does_not_pair_when_too_long(self):
        segs = to_segments(self.lines([(0, 5), (5.5, 9)]))
        assert [len(s.lines) for s in segs] == [1, 1]

    def test_padding_and_no_overlap(self):
        segs = to_segments(self.lines([(0.1, 9), (9.1, 18), (18.05, 27)]))
        assert segs[0].start == 0.0  # clamped at 0
        for a, b in zip(segs, segs[1:], strict=False):
            assert a.end <= b.start
        for s in segs:
            assert s.end >= s.lines[-1].end  # never cuts the last word
        assert segs[-1].end == 27.25

    def test_japanese_line_text_has_no_spaces(self):
        lines = to_lines([w("君", 0, 0.5), w("の", 0.5, 0.7)], "ja")
        assert line_text(lines[0], "ja") == "君の"

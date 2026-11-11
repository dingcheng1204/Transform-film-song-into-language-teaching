"""Words → lines → 1–2-line teaching segments. Pure functions (lyrics-align skill)."""

from dataclasses import dataclass

LINE_GAP_SEC = 0.6
MAX_LINE_SEC = 12.0
MAX_LINE_UNITS = {"en": 14, "ja": 25, "ko": 8}  # words / characters / eojeol
MERGE_PAIR_MAX_SEC = 8.0
PAD_BEFORE = 0.15
PAD_AFTER = 0.25
PUNCT = set("、。，．・！？!?,.「」『』（）()[]【】…‥〜~♪“”\"'：:；;")


@dataclass
class RawWord:
    text: str
    start: float | None
    end: float | None
    seg: int = 0  # Whisper segment index (a natural line boundary)


@dataclass
class Word:
    text: str
    start: float
    end: float
    seg: int = 0


@dataclass
class LineT:
    words: list[Word]

    @property
    def start(self) -> float:
        return self.words[0].start

    @property
    def end(self) -> float:
        return self.words[-1].end


@dataclass
class SegmentT:
    start: float
    end: float
    lines: list[LineT]


def is_punct(text: str) -> bool:
    return all(c in PUNCT or c.isspace() for c in text)


def fill_missing_times(words: list[RawWord]) -> list[Word]:
    """Words WhisperX could not align (start/end None) get evenly spread times between
    their aligned neighbours. Never drops a word."""
    n = len(words)
    starts: list[float | None] = [w.start for w in words]
    ends: list[float | None] = [w.end for w in words]
    i = 0
    while i < n:
        if starts[i] is not None and ends[i] is not None:
            i += 1
            continue
        j = i
        while j < n and (starts[j] is None or ends[j] is None):
            j += 1
        count = j - i
        if i > 0:
            left = float(ends[i - 1])  # type: ignore[arg-type]
            right = float(starts[j]) if j < n else left + 0.3 * count  # type: ignore[arg-type]
        elif j < n:  # leading run: place it just before the first aligned word
            right = float(starts[j])  # type: ignore[arg-type]
            left = max(0.0, right - 0.3 * count)
        else:  # nothing aligned at all
            left, right = 0.0, 0.3 * count
        right = max(right, left)
        step = (right - left) / (j - i) if j > i else 0.0
        for k in range(i, j):
            starts[k] = left + step * (k - i)
            ends[k] = left + step * (k - i + 1) if step > 0 else left + 0.01
        i = j
    out: list[Word] = []
    for w, s, e in zip(words, starts, ends, strict=True):
        s = float(s)  # type: ignore[arg-type]
        e = max(float(e), s + 0.01)  # type: ignore[arg-type]
        out.append(Word(w.text, round(s, 3), round(e, 3), w.seg))
    return out


def _units(words: list[Word], lang: str) -> int:
    return sum(len(w.text) for w in words) if lang == "ja" else len(words)


def _split_long(words: list[Word], lang: str) -> list[list[Word]]:
    too_long = (words[-1].end - words[0].start) > MAX_LINE_SEC
    too_many = _units(words, lang) > MAX_LINE_UNITS[lang]
    if len(words) < 2 or not (too_long or too_many):
        return [words]
    gaps = [words[i + 1].start - words[i].end for i in range(len(words) - 1)]
    # Largest gap; ties broken toward the middle so halves stay balanced.
    mid = (len(words) - 1) / 2
    cut = max(range(len(gaps)), key=lambda i: (round(gaps[i], 3), -abs(i - mid))) + 1
    return _split_long(words[:cut], lang) + _split_long(words[cut:], lang)


def to_lines(words: list[Word], lang: str) -> list[LineT]:
    """Break on Whisper segment changes and on silences ≥ LINE_GAP_SEC, then split
    lines that are too long at their largest internal gap."""
    words = [w for w in words if not is_punct(w.text)]
    groups: list[list[Word]] = []
    for w in words:
        if groups and w.seg == groups[-1][-1].seg and w.start - groups[-1][-1].end < LINE_GAP_SEC:
            groups[-1].append(w)
        else:
            groups.append([w])
    return [LineT(part) for g in groups for part in _split_long(g, lang)]


def to_segments(lines: list[LineT]) -> list[SegmentT]:
    """Pair consecutive lines when together they fit in MERGE_PAIR_MAX_SEC, pad the
    edges, and clamp so segments never overlap."""
    groups: list[list[LineT]] = []
    i = 0
    while i < len(lines):
        if i + 1 < len(lines) and lines[i + 1].end - lines[i].start <= MERGE_PAIR_MAX_SEC:
            groups.append([lines[i], lines[i + 1]])
            i += 2
        else:
            groups.append([lines[i]])
            i += 1

    raw_start = [max(0.0, g[0].start - PAD_BEFORE) for g in groups]
    raw_end = [g[-1].end + PAD_AFTER for g in groups]
    segs: list[SegmentT] = []
    for k, g in enumerate(groups):
        end = min(raw_end[k], raw_start[k + 1]) if k + 1 < len(groups) else raw_end[k]
        start = max(raw_start[k], segs[-1].end) if segs else raw_start[k]
        end = max(end, g[-1].end)  # never cut off the last sung word
        segs.append(SegmentT(round(start, 3), round(end, 3), g))
    return segs


def line_text(line: LineT, lang: str) -> str:
    sep = "" if lang == "ja" else " "
    return sep.join(w.text for w in line.words)

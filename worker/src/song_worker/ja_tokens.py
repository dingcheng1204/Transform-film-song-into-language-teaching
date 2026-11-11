"""Japanese: WhisperX aligns per character; merge characters back into words.

The tokenizer is injectable so tests don't need MeCab. Production uses fugashi + unidic-lite.
"""

from collections.abc import Callable
from itertools import groupby

from song_worker.segment import RawWord, is_punct

Tokenizer = Callable[[str], list[str]]


def fugashi_tokenizer() -> Tokenizer:
    import fugashi

    tagger = fugashi.Tagger()
    return lambda text: [w.surface for w in tagger(text)]


def merge_chars(chars: list[RawWord], tokenize: Tokenizer) -> list[RawWord]:
    """Group per-character RawWords into tokens, one Whisper segment at a time.
    A token's time spans its first aligned char start to its last aligned char end.
    Falls back to the characters unchanged if tokenization doesn't line up."""
    out: list[RawWord] = []
    for seg, group in groupby(chars, key=lambda c: c.seg):
        cs = [c for c in group if c.text.strip()]
        text = "".join(c.text for c in cs)
        tokens = [t for t in tokenize(text) if t.strip()]
        if "".join(tokens) != text:
            out.extend(cs)
            continue
        i = 0
        for tok in tokens:
            n = len(tok)
            part = cs[i : i + n]
            i += n
            if is_punct(tok):
                continue
            starts = [c.start for c in part if c.start is not None]
            ends = [c.end for c in part if c.end is not None]
            out.append(
                RawWord(
                    text=tok,
                    start=min(starts) if starts else None,
                    end=max(ends) if ends else None,
                    seg=seg,
                )
            )
    return out

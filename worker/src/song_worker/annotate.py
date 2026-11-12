"""P3: zh-TW translation, readings, and per-segment lessons (bilingual-subs and
pronunciation-lesson skills)."""

import json
import logging
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

from song_worker.llm import ChatModel, LLMError
from song_worker.readings import Annotator, add_readings, sentence_reading
from song_worker.timeline import Lesson, Pattern, PatternExample, Segment, Timeline

log = logging.getLogger("song_worker")
Report = Callable[[str, int], None]

LANG_NAME = {"ja": "日文", "en": "英文", "ko": "韓文"}
LIMITS = {"grammarNotes": 2, "pronunciationNotes": 3, "connectedSpeech": 3, "singingTips": 2}

TRANSLATE_SYSTEM = """你是專業的歌詞翻譯，把歌詞翻成台灣慣用的繁體中文。
規則：
- 一次看完整首歌再翻，人稱、時態、意象前後一致。
- 翻出意思和情感，不要逐字硬翻；保持一行對一行，不合併、不拆行、不省略。
- 用台灣用語（例如「影片」不是「視頻」）。
- 只輸出 JSON：{"lines": [{"i": 行號, "zh": "翻譯"}]}，行號從 0 開始，數量必須和輸入相同。"""

LESSON_SYSTEM = """你是台灣學習者的{lang_name}老師。學習者透過唱歌自然學語言：
要聽懂、會念、學到能帶走的單字和文法，也要唱得好。全部用繁體中文（台灣用語）說明。
輸入是一個教學段落（1–2 句歌詞）、每個字的讀音／羅馬拼音／演唱秒數，以及前後句當上下文。

只輸出 JSON：
{{"wordMeanings": [[...], ...], "grammarNotes": [...], "pronunciationNotes": [...],
  "connectedSpeech": [...], "singingTips": [...],
  "patterns": [{{"pattern": "...", "explanation": "...",
                 "examples": [{{"text": "...", "translation": "...", "swap": "..."}}]}}]}}

- wordMeanings：每一句一個陣列，長度和該句 words 完全相同、順序相同；每個元素是該字在這句裡的
  簡短中文意思（2–8 個字）。助詞、語尾等功能詞用括號說明作用，例如「（受詞助詞）」「（過去式）」。
- grammarNotes（最多 2 條）：這段裡值得帶走的文法或用法：助詞、動詞變化、句型、慣用說法。
  說明它的意思和用法，可以在歌以外的句子用到。{grammar_focus}
- pronunciationNotes（最多 3 條）：這段裡難發的音。{pron_focus}
- connectedSpeech（最多 3 條）：連音與音變。{connected_focus}
- singingTips（最多 2 條）：拉長音（演唱秒數特別長的字）、換氣點、一個音上塞好幾個字、節奏。
- 每條一句話，一定要引用這段裡實際出現的字詞；用到音標要附上白話或注音類比。
- patterns（0–1 個）：從這段挑一個最能帶走、日常也用得到的句型，用〔名詞〕〔動詞〕這類括號標出
  可替換的位置，explanation 用一兩句中文說明意思和使用時機。examples 給 3 句：每句只換掉 1–2 個字，
  換成日常生活常用、簡單的單字，句子要自然、文法正確、符合{lang_name}母語者的說法；
  translation 是繁體中文翻譯，swap 寫出換了什麼（例如「星 → 月」）。這段沒有適合的句型就給空陣列。
- 不要寫「多練習」之類的空話；沒有值得說的就給空陣列。"""

FOCUS = {
    "ja": {
        "pron": "例如長音、促音っ、撥音ん、母音 i/u 無聲化、ら行、し/ち/つ 等台灣人容易念錯的音",
        "connected": "例如快唱時母音合併、助詞は/へ/を 的念法、歌詞特殊讀法",
        "grammar": "例如助詞（は/が/を/に/で）、動詞て形／た形／ない形、敬體與常體、"
        "歌詞常見的文語說法",
    },
    "en": {
        "pron": "例如 th、r/l、v/f、字尾子音、長短母音",
        "connected": "例如連音 linking、彈舌 flap t、弱讀 reduction（gonna/wanna）、省略 elision",
        "grammar": "例如時態、片語動詞、口語縮寫（I'm/gonna）、歌詞常省略的主詞或助動詞",
    },
    "ko": {
        "pron": "例如平音/送氣音/緊音（ㄱ/ㅋ/ㄲ）、ㅓ 和 ㅗ 的差別、收尾音",
        "connected": "例如連音（연음）、緊音化（경음화）、鼻音化（비음화）、顎化（구개음화）、"
        "ㅎ 脫落；說明時點出是哪一條規則，並對照讀音欄位",
        "grammar": "例如助詞（은/는、이/가、을/를）、語尾（-아/어요、-고 싶다、-ㄹ까）、半語與敬語",
    },
}


def translate_song(timeline: Timeline, llm: ChatModel) -> None:
    lines = [line for s in timeline.segments for line in s.lines]
    lang = timeline.song.sourceLang.value
    user = json.dumps(
        {
            "language": LANG_NAME[lang],
            "lines": [{"i": i, "text": ln.text} for i, ln in enumerate(lines)],
        },
        ensure_ascii=False,
    )
    for attempt in range(2):
        data = llm.complete_json(TRANSLATE_SYSTEM, user)
        items = data.get("lines", []) if isinstance(data, dict) else []
        by_i = {
            int(x["i"]): str(x.get("zh", "")).strip()
            for x in items
            if isinstance(x, dict) and "i" in x
        }
        if len(by_i) == len(lines) and all(i in by_i for i in range(len(lines))):
            for i, ln in enumerate(lines):
                ln.translation = by_i[i]
            return
        log.warning(
            "translation returned %d/%d lines (attempt %d)", len(by_i), len(lines), attempt + 1
        )
    # Partial result is still better than nothing.
    for i, ln in enumerate(lines):
        ln.translation = by_i.get(i, "")


def _segment_payload(timeline: Timeline, idx: int) -> str:
    segs = timeline.segments
    seg = segs[idx]
    prev = segs[idx - 1].lines[-1].text if idx > 0 else ""
    nxt = segs[idx + 1].lines[0].text if idx + 1 < len(segs) else ""
    return json.dumps(
        {
            "previous": prev,
            "next": nxt,
            "lines": [
                {
                    "text": ln.text,
                    "translation": ln.translation,
                    "words": [
                        {
                            "text": w.text,
                            "reading": w.reading,
                            "romanization": w.romanization,
                            "sec": round(w.end - w.start, 2),
                        }
                        for w in ln.words
                    ],
                }
                for ln in seg.lines
            ],
        },
        ensure_ascii=False,
    )


def _parse_patterns(raw: object, lang: str) -> list[Pattern]:
    """Keep well-formed patterns (max 1, max 3 examples) and add example readings locally."""
    out: list[Pattern] = []
    if not isinstance(raw, list):
        return out
    for item in raw[:1]:
        if not isinstance(item, dict) or not str(item.get("pattern", "")).strip():
            continue
        examples = []
        for ex in item.get("examples", []) if isinstance(item.get("examples"), list) else []:
            if not isinstance(ex, dict) or not str(ex.get("text", "")).strip():
                continue
            text = str(ex["text"]).strip()
            reading, roman = sentence_reading(text, lang)
            examples.append(
                PatternExample(
                    text=text,
                    translation=str(ex.get("translation", "")).strip(),
                    swap=str(ex.get("swap", "")).strip() or None,
                    reading=reading,
                    romanization=roman,
                )
            )
        if examples:
            out.append(
                Pattern(
                    pattern=str(item["pattern"]).strip(),
                    explanation=str(item.get("explanation", "")).strip(),
                    examples=examples[:3],
                )
            )
    return out


def lesson_for_segment(
    timeline: Timeline, idx: int, llm: ChatModel
) -> tuple[Lesson, list[list[str]] | None]:
    """Returns the lesson and per-line word meanings (None if the model's arrays don't line up)."""
    lang = timeline.song.sourceLang.value
    f = FOCUS[lang]
    system = LESSON_SYSTEM.format(
        lang_name=LANG_NAME[lang],
        pron_focus=f["pron"],
        connected_focus=f["connected"],
        grammar_focus=f["grammar"],
    )
    data = llm.complete_json(system, _segment_payload(timeline, idx))
    if not isinstance(data, dict):
        raise LLMError("lesson is not a JSON object")
    clean = {
        k: [str(x).strip() for x in data.get(k, []) if str(x).strip()][:limit]
        for k, limit in LIMITS.items()
    }
    clean["patterns"] = _parse_patterns(data.get("patterns"), lang)
    lines = timeline.segments[idx].lines
    meanings = data.get("wordMeanings")
    ok = (
        isinstance(meanings, list)
        and len(meanings) == len(lines)
        and all(
            isinstance(m, list) and len(m) == len(ln.words)
            for m, ln in zip(meanings, lines, strict=True)
        )
    )
    if not ok and meanings is not None:
        log.warning("segment %d: wordMeanings do not match the words — skipped", idx)
    return Lesson(**clean), ([[str(x).strip() for x in m] for m in meanings] if ok else None)


def add_lessons(timeline: Timeline, llm: ChatModel, report: Report, workers: int = 4) -> None:
    n = len(timeline.segments)
    done = 0
    lock = threading.Lock()

    def one(idx: int) -> None:
        nonlocal done
        seg: Segment = timeline.segments[idx]
        try:
            lesson, meanings = lesson_for_segment(timeline, idx, llm)
            if meanings is None:  # word meanings didn't line up: one more try
                retry, retry_meanings = lesson_for_segment(timeline, idx, llm)
                if retry_meanings is not None:
                    lesson, meanings = retry, retry_meanings
            lesson.ttsUrl, lesson.ttsRate = seg.lesson.ttsUrl, seg.lesson.ttsRate  # keep P4 fields
            seg.lesson = lesson
            if meanings:
                for line, line_meanings in zip(seg.lines, meanings, strict=True):
                    for w, m in zip(line.words, line_meanings, strict=True):
                        w.meaning = m or None
        except Exception as e:  # one bad segment must not sink the job
            log.warning("lesson for segment %d failed: %s", idx, e)
        with lock:
            done += 1
            report("lessons", 90 + int(9 * done / max(n, 1)))

    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(one, range(n)))


def annotate(
    timeline: Timeline,
    llm: ChatModel | None,
    report: Report,
    annotator: Annotator | None = None,
    workers: int = 4,
) -> Timeline:
    report("readings", 86)
    add_readings(timeline, annotator)
    if llm is None:
        log.warning("no LLM configured (LLM_API_KEY) — skipping translation and lessons")
        return timeline
    report("translate", 88)
    try:
        translate_song(timeline, llm)
    except LLMError as e:
        log.warning("translation failed: %s", e)
    report("lessons", 90)
    add_lessons(timeline, llm, report, workers)
    return timeline

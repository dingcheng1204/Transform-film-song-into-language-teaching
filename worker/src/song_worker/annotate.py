"""P3: zh-TW translation, readings, and per-segment lessons (bilingual-subs and
pronunciation-lesson skills)."""

import json
import logging
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

from song_worker.llm import ChatModel, LLMError
from song_worker.readings import Annotator, add_readings
from song_worker.timeline import Lesson, Segment, Timeline

log = logging.getLogger("song_worker")
Report = Callable[[str, int], None]

LANG_NAME = {"ja": "日文", "en": "英文", "ko": "韓文"}
LIMITS = {"pronunciationNotes": 3, "connectedSpeech": 3, "singingTips": 2}

TRANSLATE_SYSTEM = """你是專業的歌詞翻譯，把歌詞翻成台灣慣用的繁體中文。
規則：
- 一次看完整首歌再翻，人稱、時態、意象前後一致。
- 翻出意思和情感，不要逐字硬翻；保持一行對一行，不合併、不拆行、不省略。
- 用台灣用語（例如「影片」不是「視頻」）。
- 只輸出 JSON：{"lines": [{"i": 行號, "zh": "翻譯"}]}，行號從 0 開始，數量必須和輸入相同。"""

LESSON_SYSTEM = """你是給台灣學習者的{lang_name}歌曲發音與唱歌老師，用繁體中文（台灣用語）說明。
輸入是一個教學段落（1–2 句歌詞）和每個字的讀音、羅馬拼音、演唱秒數，以及前後句當上下文。

輸出這一段的教學重點，只輸出 JSON：
{{"pronunciationNotes": [...], "connectedSpeech": [...], "singingTips": [...]}}

- pronunciationNotes（最多 3 條）：這段裡難發的音。{pron_focus}
- connectedSpeech（最多 3 條）：連音與音變。{connected_focus}
- singingTips（最多 2 條）：拉長音（演唱秒數特別長的字）、換氣點、一個音上塞好幾個字、節奏。
- 每條一句話，一定要引用這段裡實際出現的字詞；學習者不一定懂音標，用到音標要附上白話或注音類比。
- 不要寫「多練習」之類的空話；沒有值得說的就給空陣列。"""

FOCUS = {
    "ja": (
        "例如長音、促音っ、撥音ん、母音 i/u 無聲化、ら行、し/ち/つ 等台灣人容易念錯的音",
        "例如快唱時母音合併、助詞は/へ/を 的念法、歌詞特殊讀法",
    ),
    "en": (
        "例如 th、r/l、v/f、字尾子音、長短母音",
        "例如連音 linking、彈舌 flap t、弱讀 reduction（gonna/wanna）、省略 elision",
    ),
    "ko": (
        "例如平音/送氣音/緊音（ㄱ/ㅋ/ㄲ）、ㅓ 和 ㅗ 的差別、收尾音",
        "例如連音（연음）、緊音化（경음화）、鼻音化（비음화）、顎化（구개음화）、ㅎ 脫落；"
        "說明時點出是哪一條規則，並對照讀音欄位",
    ),
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


def lesson_for_segment(timeline: Timeline, idx: int, llm: ChatModel) -> Lesson:
    lang = timeline.song.sourceLang.value
    pron, connected = FOCUS[lang]
    system = LESSON_SYSTEM.format(
        lang_name=LANG_NAME[lang], pron_focus=pron, connected_focus=connected
    )
    data = llm.complete_json(system, _segment_payload(timeline, idx))
    if not isinstance(data, dict):
        raise LLMError("lesson is not a JSON object")
    clean = {
        k: [str(x).strip() for x in data.get(k, []) if str(x).strip()][:limit]
        for k, limit in LIMITS.items()
    }
    return Lesson(**clean)


def add_lessons(timeline: Timeline, llm: ChatModel, report: Report, workers: int = 4) -> None:
    n = len(timeline.segments)
    done = 0
    lock = threading.Lock()

    def one(idx: int) -> None:
        nonlocal done
        seg: Segment = timeline.segments[idx]
        try:
            lesson = lesson_for_segment(timeline, idx, llm)
            lesson.ttsUrl, lesson.ttsRate = seg.lesson.ttsUrl, seg.lesson.ttsRate  # keep P4 fields
            seg.lesson = lesson
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

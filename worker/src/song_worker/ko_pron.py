"""Korean standard-pronunciation rules (표준 발음법) applied inside one eojeol.

Covers the sound changes learners trip over most in lyrics:
  연음 liaison         걸어 → 거러, 앉아 → 안자
  ㅎ 탈락 h-deletion    좋아 → 조아
  구개음화 palatal.     같이 → 가치, 굳이 → 구지
  격음화 aspiration     좋다 → 조타, 축하 → 추카
  비음화 nasalization   합니다 → 함니다, 먹는 → 멍는
  유음화 lateralization 신라 → 실라, 설날 → 설랄
  경음화 tensing        학교 → 학꾜, 덥다 → 덥따
  받침 neutralization   빛 → 빋, 꽃 → 꼳
Lexical exceptions (사잇소리 like 별빛 → 별삗) are not rule-predictable;
the LLM lesson covers them.
"""

S_BASE, L_COUNT, V_COUNT, T_COUNT = 0xAC00, 19, 21, 28

L = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
V = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
T = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ",
     "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]  # fmt: skip

# Double finals: (stays, moves) for liaison; representative sound otherwise.
SPLIT = {"ㄳ": ("ㄱ", "ㅅ"), "ㄵ": ("ㄴ", "ㅈ"), "ㄶ": ("ㄴ", "ㅎ"), "ㄺ": ("ㄹ", "ㄱ"),
         "ㄻ": ("ㄹ", "ㅁ"), "ㄼ": ("ㄹ", "ㅂ"), "ㄽ": ("ㄹ", "ㅅ"), "ㄾ": ("ㄹ", "ㅌ"),
         "ㄿ": ("ㄹ", "ㅍ"), "ㅀ": ("ㄹ", "ㅎ"), "ㅄ": ("ㅂ", "ㅅ"),
         "ㄲ": ("", "ㄲ"), "ㅆ": ("", "ㅆ")}  # fmt: skip
NEUTRAL = {"ㄲ": "ㄱ", "ㅋ": "ㄱ", "ㄳ": "ㄱ", "ㄺ": "ㄱ", "ㅅ": "ㄷ", "ㅆ": "ㄷ", "ㅈ": "ㄷ",
           "ㅊ": "ㄷ", "ㅌ": "ㄷ", "ㅎ": "ㄷ", "ㅍ": "ㅂ", "ㅄ": "ㅂ", "ㄿ": "ㅂ", "ㄵ": "ㄴ",
           "ㄶ": "ㄴ", "ㄼ": "ㄹ", "ㄽ": "ㄹ", "ㄾ": "ㄹ", "ㅀ": "ㄹ", "ㄻ": "ㅁ"}  # fmt: skip
TENSE = {"ㄱ": "ㄲ", "ㄷ": "ㄸ", "ㅂ": "ㅃ", "ㅅ": "ㅆ", "ㅈ": "ㅉ"}
ASPIRATE = {"ㄱ": "ㅋ", "ㄷ": "ㅌ", "ㅂ": "ㅍ", "ㅈ": "ㅊ"}
NASAL = {"ㄱ": "ㅇ", "ㄷ": "ㄴ", "ㅂ": "ㅁ"}
OBSTRUENT_FINALS = {"ㄱ", "ㄷ", "ㅂ"}


def _split(ch: str) -> list[str] | None:
    code = ord(ch) - S_BASE
    if not 0 <= code < L_COUNT * V_COUNT * T_COUNT:
        return None
    return [L[code // (V_COUNT * T_COUNT)], V[(code // T_COUNT) % V_COUNT], T[code % T_COUNT]]


def _join(l: str, v: str, t: str) -> str:  # noqa: E741
    return chr(S_BASE + (L.index(l) * V_COUNT + V.index(v)) * T_COUNT + T.index(t))


def _neutral(t: str) -> str:
    return NEUTRAL.get(t, t)


def pronounce(word: str) -> str:
    """Return the eojeol as pronounced, in Hangul. Non-Hangul characters pass through."""
    out: list[str] = []
    i = 0
    while i < len(word):
        j = i
        while j < len(word) and _split(word[j]):
            j += 1
        if j == i:
            out.append(word[i])
            i += 1
            continue
        out.append(_pronounce_run([_split(c) for c in word[i:j]]))  # type: ignore[misc]
        i = j
    return "".join(out)


def _pronounce_run(syl: list[list[str]]) -> str:
    n = len(syl)
    for k in range(n - 1):
        cur, nxt = syl[k], syl[k + 1]
        t, l2 = cur[2], nxt[0]
        if not t:
            continue
        if l2 == "ㅇ":  # vowel-initial next syllable
            if t in ("ㅎ", "ㄶ", "ㅀ"):  # ㅎ drops (좋아 → 조아, 않아 → 아나)
                cur[2] = SPLIT[t][0] if t in SPLIT else ""
                if cur[2] and t != "ㅎ":
                    cur[2], nxt[0] = "", cur[2]
                continue
            if t == "ㅇ":
                continue
            stay, move = SPLIT.get(t, ("", t))
            if stay in OBSTRUENT_FINALS and move in TENSE:  # 없어 → 업써, 값이 → 갑씨
                move = TENSE[move]
            if move in ("ㄷ", "ㅌ") and nxt[1] == "ㅣ":  # 구개음화
                move = "ㅈ" if move == "ㄷ" else "ㅊ"
            cur[2], nxt[0] = stay, move
            continue
        if t == "ㅎ" and l2 in ASPIRATE:  # 좋다 → 조타
            cur[2], nxt[0] = "", ASPIRATE[l2]
            continue
        if t in ("ㄶ", "ㅀ") and l2 in ASPIRATE:  # 않다 → 안타
            cur[2], nxt[0] = SPLIT[t][0], ASPIRATE[l2]
            continue
        rep = _neutral(t)
        if l2 == "ㅎ" and rep in ASPIRATE:  # 축하 → 추카
            cur[2], nxt[0] = "", ASPIRATE[rep]
            continue
        if rep in NASAL and l2 in ("ㄴ", "ㅁ"):  # 비음화
            cur[2] = NASAL[rep]
            continue
        if rep in OBSTRUENT_FINALS and l2 == "ㄹ":  # 백로 → 뱅노
            cur[2], nxt[0] = NASAL[rep], "ㄴ"
            continue
        if rep in ("ㅁ", "ㅇ") and l2 == "ㄹ":  # 침략 → 침냑
            nxt[0] = "ㄴ"
            cur[2] = rep
            continue
        if (rep == "ㄴ" and l2 == "ㄹ") or (rep == "ㄹ" and l2 == "ㄴ"):  # 유음화
            cur[2], nxt[0] = "ㄹ", "ㄹ"
            continue
        if rep in OBSTRUENT_FINALS and l2 in TENSE:  # 경음화
            cur[2], nxt[0] = rep, TENSE[l2]
            continue
        cur[2] = rep
    syl[-1][2] = _neutral(syl[-1][2])
    return "".join(_join(*s) for s in syl)


def romanize(pronounced: str) -> str:
    """Revised Romanization of an already-pronounced form."""
    from korean_romanizer.romanizer import Romanizer

    return Romanizer(pronounced).romanize()

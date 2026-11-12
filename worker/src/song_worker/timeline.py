# GENERATED from schema/timeline.schema.json by `uv run gen-models` — do not edit.

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SourceLang(Enum):
    en = 'en'
    ja = 'ja'
    ko = 'ko'


class TargetLang(Enum):
    zh_TW = 'zh-TW'


class Song(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    youtubeId: str = Field(..., pattern='^[A-Za-z0-9_-]{11}$')
    title: str = Field(..., min_length=1)
    artist: str | None = None
    durationSec: float = Field(
        ..., description='Input limit: 6 minutes.', gt=0.0, le=360.0
    )
    sourceLang: SourceLang = Field(..., description='Language being sung.')
    targetLang: TargetLang = Field(
        ..., description='Translation / explanation language.'
    )


class Word(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    text: str = Field(..., min_length=1)
    start: float = Field(..., ge=0.0)
    end: float = Field(..., gt=0.0)
    reading: str | None = Field(
        None,
        description='ja: hiragana reading (furigana). ko: Hangul as actually pronounced after sound changes (e.g. 같이 → 가치). en: IPA.',
    )
    romanization: str | None = Field(
        None,
        description='ja: Hepburn romaji. ko: Revised Romanization of the pronounced form. en: omitted.',
    )
    meaning: str | None = Field(
        None,
        description='Short zh-TW gloss of this word in context (e.g. 夜空 → 夜空, を → （受詞助詞）). Shown when the learner taps the word.',
    )


class PatternExample(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    text: str = Field(
        ...,
        description="New sentence in the song's language built from the pattern.",
        min_length=1,
    )
    translation: str = Field(..., description='zh-TW translation.')
    swap: str | None = Field(
        None, description='What was substituted, e.g. 「星 → 月」.'
    )
    reading: str | None = Field(
        None,
        description='ja: whole sentence in hiragana. ko: pronounced Hangul. en: omitted.',
    )
    romanization: str | None = Field(
        None, description='ja: Hepburn. ko: Revised Romanization. en: omitted.'
    )


class Line(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    text: str = Field(..., description='Original sung text.', min_length=1)
    translation: str = Field(..., description='zh-TW translation.')
    start: float = Field(..., ge=0.0)
    end: float = Field(..., gt=0.0)
    words: list[Word]


class Pattern(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    pattern: str = Field(
        ...,
        description='The pattern with slots, e.g. 「〔名詞〕に光る〔名詞〕」 / "I want to ___" / "〔名詞〕를 좋아해".',
        min_length=1,
    )
    explanation: str = Field(
        ..., description='zh-TW: what the pattern means and when to use it.'
    )
    examples: list[PatternExample] = Field(..., max_length=4, min_length=1)


class Lesson(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    grammarNotes: list[str] | None = Field(
        None,
        description='zh-TW notes on grammar and usage in this segment (particles, conjugations, set phrases) — what the learner can reuse outside the song.',
    )
    pronunciationNotes: list[str] = Field(
        ..., description='zh-TW notes on hard sounds in this segment.'
    )
    connectedSpeech: list[str] = Field(
        ..., description='Linking, reduction, elision, devoicing, long vowels, etc.'
    )
    singingTips: list[str] = Field(
        ..., description='Rhythm, held notes, breath points.'
    )
    ttsUrl: str | None = Field(
        None,
        description='Path in Supabase Storage bucket song-tts for the slow reading (P4+).',
    )
    ttsRate: float | None = Field(
        None, description='Speaking rate used for the TTS reading.', ge=0.5, le=1.0
    )
    patterns: list[Pattern] | None = Field(
        None,
        description='Reusable sentence patterns from this segment with substitution examples (P4).',
        max_length=2,
    )


class Segment(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    id: int = Field(..., ge=0)
    start: float = Field(..., ge=0.0)
    end: float = Field(..., gt=0.0)
    lines: list[Line] = Field(..., max_length=2, min_length=1)
    lesson: Lesson


class Timeline(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    schemaVersion: Literal['1.0']
    song: Song
    segments: list[Segment] = Field(..., min_length=1)

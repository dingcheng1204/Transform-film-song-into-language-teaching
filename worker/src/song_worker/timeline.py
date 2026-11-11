# GENERATED from schema/timeline.schema.json by `uv run gen-models` — do not edit.

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SourceLang(Enum):
    en = 'en'
    ja = 'ja'


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
        None, description='ja: hiragana reading (furigana). en: IPA.'
    )
    romaji: str | None = Field(None, description='ja only: Hepburn romanization.')


class Lesson(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
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


class Line(BaseModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    text: str = Field(..., description='Original sung text.', min_length=1)
    translation: str = Field(..., description='zh-TW translation.')
    start: float = Field(..., ge=0.0)
    end: float = Field(..., gt=0.0)
    words: list[Word]


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

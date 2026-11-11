"""WhisperX transcription + word-level alignment (lyrics-align skill)."""

from pathlib import Path

from song_worker.errors import JobError
from song_worker.segment import RawWord


def transcribe_and_align(
    vocals16k: Path,
    lang: str,
    model_name: str = "medium",
    device: str = "cpu",
    compute_type: str = "int8",
    batch_size: int = 4,
) -> list[RawWord]:
    """Return words with timings. For ja, WhisperX yields one entry per character;
    merge them with song_worker.ja_tokens afterwards."""
    import whisperx

    try:
        audio = whisperx.load_audio(str(vocals16k))
        # Language is passed explicitly — auto-detect is unreliable on singing.
        # Silero VAD avoids the pyannote model's Hugging Face token requirement.
        model = whisperx.load_model(
            model_name, device, compute_type=compute_type, language=lang, vad_method="silero"
        )
        result = model.transcribe(audio, batch_size=batch_size, language=lang)
        align_model, metadata = whisperx.load_align_model(language_code=lang, device=device)
        aligned = whisperx.align(
            result["segments"], align_model, metadata, audio, device, return_char_alignments=False
        )
    except Exception as e:  # model download / decode / OOM
        raise JobError("transcription_failed", f"{type(e).__name__}: {e}") from e

    words: list[RawWord] = []
    for seg_idx, seg in enumerate(aligned.get("segments", [])):
        for w in seg.get("words", []):
            text = str(w.get("word", "")).strip()
            if text:
                words.append(
                    RawWord(text=text, start=w.get("start"), end=w.get("end"), seg=seg_idx)
                )
    if not words:
        raise JobError("no_lyrics", "no words recognized")
    return words

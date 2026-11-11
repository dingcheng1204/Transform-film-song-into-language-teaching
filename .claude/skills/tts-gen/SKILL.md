---
name: tts-gen
description: Use when adding or changing the slow spoken reading of each segment — TTS provider calls, SSML speaking rate, file naming, and upload to the Supabase Storage bucket song-tts.
---

# tts-gen

## Provider
Decided in P4 (Azure Speech or Google Cloud TTS — both support SSML `<prosody rate>` and en-US / ja-JP neural voices). Wrap it behind one function so the provider can be swapped:

```python
def synthesize(text: str, lang: str, rate: float) -> bytes:  # returns mp3
```

## Rules
- Speak the **lyric text as spoken language**, not sung. One mp3 per segment (both lines, with a short `<break time="400ms"/>` between them).
- Default `rate = 0.75`; store it in `Lesson.ttsRate`.
- Voices: en → a neutral US voice; ja → a standard Tokyo-accent voice. Pin voice names in config, not in code.
- Cache key = sha1(lang + voice + rate + text). If the object already exists in Storage, skip the API call.

## Storage
- Bucket: `song-tts` (in the shared flight-price-notifier Supabase project).
- Path: `<youtube_id>/<segment_id>-<hash8>.mp3` → write that path to `Lesson.ttsUrl`.
- Bucket is private; the web app gets short-lived signed URLs. Upload with the service-role key (worker only).

## Cost guard
Log characters sent per job; abort the TTS stage if a single job exceeds 5,000 characters (a 6-min song should be far below that).

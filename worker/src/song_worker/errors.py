"""Job error codes written to song_teaching.jobs.error (see audio-ingest skill)."""


class JobError(Exception):
    """A failure we can explain to the user. `code` is stored in jobs.error."""

    CODES = {
        "too_long",
        "live_stream",
        "unavailable",
        "download_failed",
        "separation_failed",
        "transcription_failed",
        "no_lyrics",
    }

    def __init__(self, code: str, detail: str = ""):
        if code not in self.CODES:
            raise ValueError(f"unknown job error code: {code}")
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code
        self.detail = detail

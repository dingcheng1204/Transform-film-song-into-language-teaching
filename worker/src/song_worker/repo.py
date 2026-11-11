"""Supabase access for the worker via PostgREST (service-role key, song_teaching schema)."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

import httpx


@dataclass
class Job:
    id: str
    youtube_id: str
    source_lang: str
    title: str | None = None
    duration_sec: float | None = None
    attempts: int = 0

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Job":
        return cls(
            id=row["id"],
            youtube_id=row["youtube_id"],
            source_lang=row["source_lang"],
            title=row.get("title"),
            duration_sec=float(row["duration_sec"]) if row.get("duration_sec") else None,
            attempts=row.get("attempts", 0),
        )


class JobRepo(Protocol):
    def claim(self) -> Job | None: ...
    def progress(self, job_id: str, stage: str, progress: int) -> None: ...
    def save_timeline(self, job: Job, timeline: dict[str, Any]) -> None: ...
    def finish(self, job_id: str) -> None: ...
    def fail(self, job_id: str, error: str) -> None: ...


def _now() -> str:
    return datetime.now(UTC).isoformat()


class SupabaseRepo:
    def __init__(
        self, url: str, service_role_key: str, transport: httpx.BaseTransport | None = None
    ):
        self.http = httpx.Client(
            base_url=f"{url}/rest/v1",
            headers={
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Accept-Profile": "song_teaching",
                "Content-Profile": "song_teaching",
            },
            timeout=30,
            transport=transport,
        )

    def _patch_job(self, job_id: str, fields: dict[str, Any]) -> None:
        r = self.http.patch("/jobs", params={"id": f"eq.{job_id}"}, json=fields)
        r.raise_for_status()

    def claim(self) -> Job | None:
        r = self.http.post("/rpc/claim_job", json={})
        r.raise_for_status()
        rows = r.json()
        return Job.from_row(rows[0]) if rows else None

    def progress(self, job_id: str, stage: str, progress: int) -> None:
        self._patch_job(job_id, {"stage": stage, "progress": progress})

    def save_timeline(self, job: Job, timeline: dict[str, Any]) -> None:
        r = self.http.post(
            "/timelines",
            params={"on_conflict": "youtube_id,source_lang"},
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            json={
                "youtube_id": job.youtube_id,
                "source_lang": job.source_lang,
                "job_id": job.id,
                "schema_version": timeline["schemaVersion"],
                "timeline": timeline,
            },
        )
        r.raise_for_status()

    def finish(self, job_id: str) -> None:
        self._patch_job(
            job_id, {"status": "done", "stage": "done", "progress": 100, "finished_at": _now()}
        )

    def fail(self, job_id: str, error: str) -> None:
        self._patch_job(job_id, {"status": "failed", "error": error[:500], "finished_at": _now()})

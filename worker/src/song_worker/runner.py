"""Job loop: claim → process → save → finish/fail. Always cleans up downloaded audio."""

import logging
import shutil
import time
from pathlib import Path

from song_worker.errors import JobError
from song_worker.pipeline import Stages, process
from song_worker.repo import Job, JobRepo

log = logging.getLogger("song_worker")


def run_job(job: Job, repo: JobRepo, stages: Stages, data_dir: Path) -> bool:
    """Process one claimed job. Returns True on success."""
    workdir = data_dir / job.id
    log.info("job %s: %s [%s]", job.id, job.youtube_id, job.source_lang)
    try:
        timeline = process(
            job.youtube_id,
            job.source_lang,
            workdir,
            stages,
            report=lambda stage, pct: repo.progress(job.id, stage, pct),
        )
        repo.save_timeline(job, timeline.model_dump(mode="json", exclude_none=True))
        repo.finish(job.id)
        log.info("job %s: done, %d segments", job.id, len(timeline.segments))
        return True
    except JobError as e:
        log.warning("job %s: failed %s", job.id, e)
        repo.fail(job.id, e.code)
        return False
    except Exception as e:
        log.exception("job %s: internal error", job.id)
        repo.fail(job.id, f"internal: {type(e).__name__}")
        return False
    finally:
        shutil.rmtree(workdir, ignore_errors=True)  # never keep source audio around


def run_forever(
    repo: JobRepo, stages: Stages, data_dir: Path, poll_seconds: float = 5.0, once: bool = False
) -> None:
    log.info("worker started, polling every %.0fs", poll_seconds)
    while True:
        job = repo.claim()
        if job:
            run_job(job, repo, stages, data_dir)
        if once:
            return
        if not job:
            time.sleep(poll_seconds)

from pathlib import Path

from song_worker.errors import JobError
from song_worker.pipeline import Stages
from song_worker.repo import Job
from song_worker.runner import run_forever, run_job
from song_worker.segment import RawWord
from song_worker.timeline import Timeline


class FakeRepo:
    def __init__(self, jobs=()):
        self.jobs = list(jobs)
        self.events = []
        self.saved = None

    def claim(self):
        return self.jobs.pop(0) if self.jobs else None

    def progress(self, job_id, stage, progress):
        self.events.append(("progress", stage, progress))

    def save_timeline(self, job, timeline):
        self.saved = timeline

    def finish(self, job_id):
        self.events.append(("finish",))

    def fail(self, job_id, error):
        self.events.append(("fail", error))


def fake_stages(tmp: Path, align_words=None, probe_info=None, fail_at=None):
    def probe(_id):
        if fail_at == "probe":
            raise RuntimeError("boom")
        return probe_info or {"title": "Song", "duration": 120}

    def download(_id, workdir):
        workdir.mkdir(parents=True, exist_ok=True)
        f = workdir / "source.wav"
        f.write_bytes(b"x")
        return f

    def separate(audio):
        if fail_at == "separate":
            raise JobError("separation_failed")
        v = audio.parent / "vocals16k.wav"
        v.write_bytes(b"x")
        return v

    words = align_words or [
        RawWord("Walk", 2.0, 2.4), RawWord("me", 2.4, 2.6), RawWord("out", 2.6, 3.0, 0),
        RawWord("Hold", 5.0, 5.4, 1), RawWord("on", 5.4, 6.0, 1),
    ]  # fmt: skip

    return Stages(
        probe=probe,
        download=download,
        separate=separate,
        align=lambda _v, _lang: words,
        ja_tokenizer=lambda: lambda text: list(text),
    )


JOB = Job(id="11111111-1111-1111-1111-111111111111", youtube_id="M7lc1UVf-VE", source_lang="en")


def test_success_saves_valid_timeline_and_cleans_up(tmp_path):
    repo = FakeRepo()
    assert run_job(JOB, repo, fake_stages(tmp_path), tmp_path)
    t = Timeline.model_validate(repo.saved)
    assert t.song.title == "Song"
    assert [ln.text for s in t.segments for ln in s.lines] == ["Walk me out", "Hold on"]
    stages = [e[1] for e in repo.events if e[0] == "progress"]
    assert stages == ["probe", "download", "separate", "align", "segment"]
    assert repo.events[-1] == ("finish",)
    assert not (tmp_path / JOB.id).exists()


def test_job_error_is_reported_with_code(tmp_path):
    repo = FakeRepo()
    assert not run_job(JOB, repo, fake_stages(tmp_path, fail_at="separate"), tmp_path)
    assert repo.events[-1] == ("fail", "separation_failed")
    assert repo.saved is None
    assert not (tmp_path / JOB.id).exists()


def test_too_long_detected_before_download(tmp_path):
    repo = FakeRepo()
    run_job(JOB, repo, fake_stages(tmp_path, probe_info={"duration": 400}), tmp_path)
    assert repo.events[-1] == ("fail", "too_long")
    assert ("progress", "download", 5) not in repo.events


def test_unexpected_error_is_internal(tmp_path):
    repo = FakeRepo()
    run_job(JOB, repo, fake_stages(tmp_path, fail_at="probe"), tmp_path)
    assert repo.events[-1] == ("fail", "internal: RuntimeError")


def test_japanese_uses_tokenizer(tmp_path):
    repo = FakeRepo()
    chars = [RawWord(c, i * 0.3, i * 0.3 + 0.3) for i, c in enumerate("君の")]
    job = Job(id=JOB.id, youtube_id=JOB.youtube_id, source_lang="ja")
    run_job(job, repo, fake_stages(tmp_path, align_words=chars), tmp_path)
    t = Timeline.model_validate(repo.saved)
    assert t.segments[0].lines[0].text == "君の"


def test_run_forever_once_processes_one_job(tmp_path):
    repo = FakeRepo([JOB, JOB])
    run_forever(repo, fake_stages(tmp_path), tmp_path, once=True)
    assert len(repo.jobs) == 1


def test_run_forever_once_with_empty_queue_returns(tmp_path):
    run_forever(FakeRepo(), fake_stages(tmp_path), tmp_path, once=True)

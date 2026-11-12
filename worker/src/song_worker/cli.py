"""song-worker CLI.

uv run song-worker run [--once]                          # poll Supabase for jobs
uv run song-worker local <url|id> --lang ja              # process one song, write JSON, no Supabase
uv run song-worker annotate <url|id> --lang ja           # redo P3 (translation/readings/lessons)
                                                         # on a timeline already in Supabase
uv run song-worker annotate-file <timeline.json> [--out f]  # same, on a local file
uv run song-worker validate <timeline.json>
"""

import argparse
import logging
import re
import sys
import tempfile
from pathlib import Path

from pydantic import ValidationError

from song_worker.timeline import Timeline


def validate(path: Path) -> int:
    try:
        t = Timeline.model_validate_json(path.read_text(encoding="utf-8"))
    except ValidationError as e:
        print(e, file=sys.stderr)
        return 1
    print(f"ok: {t.song.title} — {len(t.segments)} segments")
    return 0


def _youtube_id(s: str) -> str:
    m = re.search(r"(?:v=|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})", s)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", s):
        return s
    raise SystemExit(f"not a YouTube URL or id: {s}")


def _log_progress(stage: str, pct: int) -> None:
    logging.info("%3d%% %s", pct, stage)


def main() -> None:
    p = argparse.ArgumentParser(prog="song-worker")
    sub = p.add_subparsers(dest="cmd", required=True)

    v = sub.add_parser("validate", help="validate a timeline JSON file")
    v.add_argument("path", type=Path)

    r = sub.add_parser("run", help="process jobs from Supabase")
    r.add_argument("--once", action="store_true", help="process at most one job, then exit")

    lo = sub.add_parser("local", help="process one song locally and write timeline JSON")
    lo.add_argument("video", help="YouTube URL or 11-char id")
    lo.add_argument("--lang", required=True, choices=["ja", "en", "ko"])
    lo.add_argument("--out", type=Path, default=None)

    an = sub.add_parser(
        "annotate", help="re-run translation/readings/lessons for a stored timeline"
    )
    an.add_argument("video", help="YouTube URL or 11-char id")
    an.add_argument("--lang", required=True, choices=["ja", "en", "ko"])

    af = sub.add_parser("annotate-file", help="re-run translation/readings/lessons on a JSON file")
    af.add_argument("path", type=Path)
    af.add_argument("--out", type=Path, default=None)

    args = p.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.cmd == "validate":
        sys.exit(validate(args.path))

    from song_worker.annotate import annotate
    from song_worker.config import Settings

    settings = Settings.from_env(require_supabase=args.cmd in ("run", "annotate"))

    if args.cmd == "annotate-file":
        t = Timeline.model_validate_json(args.path.read_text(encoding="utf-8"))
        annotate(t, settings.make_llm(), _log_progress, workers=settings.llm_concurrency)
        out = args.out or args.path
        out.write_text(t.model_dump_json(indent=2, exclude_none=True), encoding="utf-8")
        print(f"wrote {out}")
        return

    if args.cmd == "annotate":
        from song_worker.repo import SupabaseRepo

        repo = SupabaseRepo(settings.supabase_url, settings.supabase_service_role_key)
        vid = _youtube_id(args.video)
        data = repo.get_timeline(vid, args.lang)
        if data is None:
            raise SystemExit(f"no timeline for {vid} [{args.lang}] in Supabase")
        t = Timeline.model_validate(data)
        annotate(t, settings.make_llm(), _log_progress, workers=settings.llm_concurrency)
        repo.update_timeline(vid, args.lang, t.model_dump(mode="json", exclude_none=True))
        print(f"updated {vid} [{args.lang}] — {len(t.segments)} segments")
        return

    from song_worker.pipeline import default_stages

    stages = default_stages(settings)

    if args.cmd == "run":
        from song_worker.repo import SupabaseRepo
        from song_worker.runner import run_forever

        repo = SupabaseRepo(settings.supabase_url, settings.supabase_service_role_key)
        run_forever(repo, stages, settings.data_dir, settings.poll_seconds, once=args.once)
        return

    from song_worker.pipeline import process

    vid = _youtube_id(args.video)
    out = args.out or Path(f"{vid}.{args.lang}.timeline.json")
    tmp_parent = settings.data_dir if settings.data_dir.exists() else None
    with tempfile.TemporaryDirectory(dir=tmp_parent) as d:
        timeline = process(vid, args.lang, Path(d), stages, report=_log_progress)
    out.write_text(timeline.model_dump_json(indent=2, exclude_none=True), encoding="utf-8")
    print(f"wrote {out} — {len(timeline.segments)} segments")


if __name__ == "__main__":
    main()

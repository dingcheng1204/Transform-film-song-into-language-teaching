"""song-worker CLI.

uv run song-worker run [--once]                 # poll Supabase for jobs
uv run song-worker local <url|id> --lang ja     # process one song, write JSON, no Supabase
uv run song-worker validate <timeline.json>
"""

import argparse
import logging
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
    import re

    m = re.search(r"(?:v=|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})", s)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", s):
        return s
    raise SystemExit(f"not a YouTube URL or id: {s}")


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

    args = p.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.cmd == "validate":
        sys.exit(validate(args.path))

    from song_worker.config import Settings
    from song_worker.pipeline import default_stages

    settings = Settings.from_env(require_supabase=args.cmd == "run")
    stages = default_stages(
        settings.whisper_model, settings.device, settings.compute_type, settings.batch_size
    )

    if args.cmd == "run":
        from song_worker.repo import SupabaseRepo
        from song_worker.runner import run_forever

        repo = SupabaseRepo(settings.supabase_url, settings.supabase_service_role_key)
        run_forever(repo, stages, settings.data_dir, settings.poll_seconds, once=args.once)
        return

    from song_worker.pipeline import process

    vid = _youtube_id(args.video)
    out = args.out or Path(f"{vid}.{args.lang}.timeline.json")
    with tempfile.TemporaryDirectory(
        dir=settings.data_dir if settings.data_dir.exists() else None
    ) as d:
        timeline = process(
            vid, args.lang, Path(d), stages, report=lambda s, pct: logging.info("%3d%% %s", pct, s)
        )
    out.write_text(timeline.model_dump_json(indent=2, exclude_none=True), encoding="utf-8")
    print(f"wrote {out} — {len(timeline.segments)} segments")


if __name__ == "__main__":
    main()

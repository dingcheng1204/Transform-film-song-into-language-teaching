"""song-worker CLI.

uv run song-worker validate <timeline.json>
"""

import argparse
import sys
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


def main() -> None:
    p = argparse.ArgumentParser(prog="song-worker")
    sub = p.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("validate", help="validate a timeline JSON file")
    v.add_argument("path", type=Path)
    args = p.parse_args()
    if args.cmd == "validate":
        sys.exit(validate(args.path))


if __name__ == "__main__":
    main()

"""Generate timeline.py (Pydantic v2) from ../schema/timeline.schema.json.

Run: uv run gen-models   (CI checks the output is up to date)
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCHEMA = ROOT / "schema" / "timeline.schema.json"
OUT = Path(__file__).with_name("timeline.py")


def main() -> None:
    cmd = [
        "datamodel-codegen",
        "--input",
        str(SCHEMA),
        "--input-file-type",
        "jsonschema",
        "--output",
        str(OUT),
        "--output-model-type",
        "pydantic_v2.BaseModel",
        "--target-python-version",
        "3.11",
        "--use-standard-collections",
        "--use-union-operator",
        "--field-constraints",
        "--disable-timestamp",
        "--custom-file-header",
        "# GENERATED from schema/timeline.schema.json by `uv run gen-models` — do not edit.",
    ]
    sys.exit(subprocess.call(cmd))


if __name__ == "__main__":
    main()

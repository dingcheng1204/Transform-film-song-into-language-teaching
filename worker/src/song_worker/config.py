"""Worker settings from environment variables (and worker/.env if present)."""

import os
from dataclasses import dataclass
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parents[2]


def load_dotenv(path: Path = WORKER_DIR / ".env") -> None:
    """Minimal .env loader: KEY=VALUE lines, # comments. Existing env vars win."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    data_dir: Path
    # CPU defaults (no NVIDIA GPU). "small" is ~4x faster than "medium" on CPU but less accurate.
    whisper_model: str = "medium"
    device: str = "cpu"
    compute_type: str = "int8"
    batch_size: int = 4
    poll_seconds: float = 5.0

    @classmethod
    def from_env(cls, require_supabase: bool = True) -> "Settings":
        load_dotenv()
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if require_supabase and not (url and key):
            raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in worker/.env")
        return cls(
            supabase_url=url.rstrip("/"),
            supabase_service_role_key=key,
            data_dir=Path(os.environ.get("DATA_DIR", WORKER_DIR / "data")),
            whisper_model=os.environ.get("WHISPER_MODEL", "medium"),
            device=os.environ.get("DEVICE", "cpu"),
            compute_type=os.environ.get("COMPUTE_TYPE", "int8"),
            batch_size=int(os.environ.get("BATCH_SIZE", "4")),
            poll_seconds=float(os.environ.get("POLL_SECONDS", "5")),
        )

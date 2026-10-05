"""Export the synthetic replay to a static file so the app works without the backend.

    python scripts/export_static_session.py

The synthetic session is deterministic (backend/provider.py), so the file is identical to
what /api/v1/session/replay returns. Used as a fallback when no API is available (Vercel).
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from backend.provider import replay  # noqa: E402

out = ROOT / "public/data/synthetic-replay.json"
out.write_text(replay().model_dump_json(), encoding="utf-8")
print(f"{out.relative_to(ROOT)}: {out.stat().st_size / 1e6:.2f} MB")

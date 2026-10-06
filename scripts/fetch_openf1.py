"""Download OpenF1 data for one meeting into data/raw/openf1/<meeting>/ (gitignored).

    python scripts/fetch_openf1.py --meeting 1308            # all sessions
    python scripts/fetch_openf1.py --meeting 1308 --dry-run  # list requests only

Resumable: every response is cached as gzip JSON and skipped on the next run.
Throttled to 25 requests per minute: OpenF1 publishes 30 per 10 s per IP, but sustained
downloads drew HTTP 429 well below that, so the pipeline stays under the observed limit.
"""
from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from openf1_common import (  # noqa: E402
    ATTRIBUTION, DRIVER_ENDPOINTS, ROOT, SESSION_ENDPOINTS, WINDOWED_ENDPOINTS,
    RateLimiter, fetch, parse_time, read_cache, url, windows, write_cache,
)

# Race weekends start data well before the session clock (grid, formation); keep margins.
BEFORE = timedelta(minutes=75)
AFTER = timedelta(minutes=30)


def actual_end(session: dict, base: Path):
    """Latest moment the session really ran: scheduled end, last timed lap, last race-control
    message. Delayed sessions (the 2026 race started 93 minutes late) run past the schedule."""
    end = parse_time(session["date_end"])
    laps_path, control_path = ROOT / base / "laps.json.gz", ROOT / base / "race_control.json.gz"
    if laps_path.exists():
        for lap in read_cache(laps_path)["rows"]:
            if lap.get("date_start") and lap.get("lap_duration"):
                end = max(end, parse_time(lap["date_start"]) + timedelta(seconds=lap["lap_duration"]))
    if control_path.exists():
        for row in read_cache(control_path)["rows"]:
            if row.get("date"):
                end = max(end, parse_time(row["date"]))
    return end


def plan(session: dict, drivers: list[int], minutes: int) -> list[tuple[str, Path]]:
    key = session["session_key"]
    base = Path("data/raw/openf1") / str(session["meeting_key"]) / str(key)
    start = parse_time(session["date_start"]) - BEFORE
    # Window grid stays anchored at `start`, so cached windows are reused when `end` grows.
    end = actual_end(session, base) + AFTER
    jobs = [(url(e, {"session_key": key}), base / f"{e}.json.gz") for e in SESSION_ENDPOINTS]
    for e in WINDOWED_ENDPOINTS:
        for i, w in enumerate(windows(start, end, minutes)):
            jobs.append((url(e, {"session_key": key}, w), base / e / f"{minutes}m" / f"{i:03d}.json.gz"))
    for number in drivers:
        for e in DRIVER_ENDPOINTS:
            for i, w in enumerate(windows(start, end, minutes)):
                jobs.append((
                    url(e, {"session_key": key, "driver_number": number}, w),
                    base / e / str(number) / f"{minutes}m" / f"{i:03d}.json.gz",
                ))
    return jobs


def cached(address: str, path: Path) -> bool:
    """A cached window counts only if it was fetched for exactly this URL. A run that ended at
    the scheduled finish cached a short last window; reusing it after the end moved later left
    a 15-minute hole in the 2026 race (09:30-09:45 UTC) for every driver."""
    if not (ROOT / path).exists():
        return False
    try:
        return read_cache(ROOT / path)["meta"]["url"] == address
    except (OSError, KeyError, ValueError):
        return False


def run(jobs: list[tuple[str, Path]], limiter: RateLimiter, workers: int) -> dict[str, int]:
    pending = [(u, p) for u, p in jobs if not cached(u, p)]
    print(f"{len(jobs)} requests, {len(jobs) - len(pending)} cached, {len(pending)} to fetch", flush=True)
    done = 0
    failed: list[str] = []

    def one(job: tuple[str, Path]) -> None:
        nonlocal done
        address, path = job
        try:
            rows, retrieved = fetch(address, limiter)
        except Exception as error:  # keep going; a rerun retries from the cache
            failed.append(address)
            print(f"  FAILED {address} ({error})", flush=True)
            return
        write_cache(ROOT / path, rows, {"url": address, "retrieved": retrieved, "rows": len(rows)})
        done += 1
        if done % 100 == 0:
            print(f"  {done}/{len(pending)}", flush=True)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(one, pending))
    return {"fetched": done, "failed": len(failed), "cached": len(jobs) - len(pending)}


def provenance(session: dict, jobs: list[tuple[str, Path]]) -> dict:
    counts: dict[str, int] = {}
    retrieved: list[str] = []
    for _, path in jobs:
        meta = read_cache(ROOT / path)["meta"]
        # data/raw/openf1/<meeting>/<session>/<endpoint>/... ; session-level files sit one level up.
        endpoint = path.parts[5] if len(path.parts) > 6 else path.name.removesuffix(".json.gz")
        counts[endpoint] = counts.get(endpoint, 0) + meta["rows"]
        retrieved.append(meta["retrieved"])
    return {
        "source": "OpenF1",
        "attribution": ATTRIBUTION,
        "meeting_key": session["meeting_key"],
        "session_key": session["session_key"],
        "session_name": session["session_name"],
        "date_start": session["date_start"],
        "date_end": session["date_end"],
        "requests": len(jobs),
        "endpoint_urls": sorted({u.split("&date")[0] for u, _ in jobs}),
        "retrieved_first": min(retrieved),
        "retrieved_last": max(retrieved),
        "row_counts": counts,
        "excluded_fields": ["headshot_url (formula1.com images, never used)"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--meeting", type=int, default=1308)
    parser.add_argument("--sessions", default="all", help="comma-separated session keys, or all")
    parser.add_argument("--window-minutes", type=int, default=30)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    limiter = RateLimiter()
    meeting_dir = ROOT / "data/raw/openf1" / str(args.meeting)
    sessions_path = meeting_dir / "sessions.json.gz"
    if not sessions_path.exists():
        rows, retrieved = fetch(url("sessions", {"meeting_key": args.meeting}), limiter)
        write_cache(sessions_path, rows, {"url": url("sessions", {"meeting_key": args.meeting}), "retrieved": retrieved, "rows": len(rows)})
    sessions = read_cache(sessions_path)["rows"]
    wanted = None if args.sessions == "all" else {int(s) for s in args.sessions.split(",")}
    incomplete = False
    for session in sessions:
        if wanted and session["session_key"] not in wanted:
            continue
        print(f"== {session['session_key']} {session['session_name']}", flush=True)
        drivers_path = meeting_dir / str(session["session_key"]) / "drivers.json.gz"
        if not drivers_path.exists():
            address = url("drivers", {"session_key": session["session_key"]})
            rows, retrieved = fetch(address, limiter)
            write_cache(drivers_path, rows, {"url": address, "retrieved": retrieved, "rows": len(rows)})
        drivers = sorted({r["driver_number"] for r in read_cache(drivers_path)["rows"]})
        # Session-level data first: laps and race control decide how far the windows must reach.
        session_jobs = [j for j in plan(session, drivers, args.window_minutes) if j[1].parent.name == str(session["session_key"])]
        if not args.dry_run:
            run(session_jobs, limiter, args.workers)
        jobs = plan(session, drivers, args.window_minutes)
        if args.dry_run:
            print(f"  {len(drivers)} drivers, {len(jobs)} requests")
            continue
        result = run(jobs, limiter, args.workers)
        if result["failed"]:
            print(f"  {result['failed']} requests failed; rerun to resume. No provenance written yet.", flush=True)
            incomplete = True
            continue
        out = meeting_dir / str(session["session_key"]) / "provenance.json"
        out.write_text(json.dumps(provenance(session, jobs), indent=2), encoding="utf-8")
        print(f"  provenance -> {out.relative_to(ROOT)}", flush=True)
    if incomplete:
        sys.exit(2)


if __name__ == "__main__":
    main()

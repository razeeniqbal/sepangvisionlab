"""Turn cached OpenF1 downloads into compact replay files for the app.

    python scripts/build_recorded_session.py --meeting 1308

Reads data/raw/openf1/<meeting>/<session_key>/ (written by fetch_openf1.py) and writes
public/sessions/<meeting>/<slug>/session.json and drivers/<number>.json.
Columns are integers; time, x, y and z are delta-encoded. Prints raw and gzip sizes.
"""
from __future__ import annotations

import argparse
import gzip
import json
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from openf1_common import ATTRIBUTION, ROOT, parse_time, read_cache  # noqa: E402

SCHEMA_VERSION = 1
SLUGS = {"Practice 1": "fp1", "Practice 2": "fp2", "Practice 3": "fp3", "Qualifying": "qualifying", "Race": "race", "Sprint": "sprint", "Sprint Qualifying": "sprint-qualifying"}
DRIVER_FIELDS = ("driver_number", "name_acronym", "full_name", "first_name", "last_name", "broadcast_name", "team_name", "team_colour")
BUDGET_GZIP_BYTES = 15 * 1024 * 1024


def delta(values: list[int]) -> list[int]:
    out, previous = [], 0
    for v in values:
        out.append(v - previous)
        previous = v
    return out


def undelta(values: list[int]) -> list[int]:
    out, total = [], 0
    for v in values:
        total += v
        out.append(total)
    return out


def ms(moment, t0) -> int:
    return round((parse_time(moment) - t0).total_seconds() * 1000)


def driver_identity(row: dict) -> dict:
    """Identity fields only. headshot_url (formula1.com images) is never copied."""
    return {k: row.get(k) for k in DRIVER_FIELDS}


def location_columns(rows: list[dict], t0, t1) -> dict:
    """Sorted, de-duplicated samples inside [t0, t1]. Exact (0,0,0) is OpenF1's 'no fix'."""
    kept: dict[int, tuple[int, int, int]] = {}
    for r in rows:
        if r["x"] == 0 and r["y"] == 0 and r["z"] == 0:
            continue
        t = ms(r["date"], t0)
        if 0 <= t <= (t1 - t0).total_seconds() * 1000:
            kept[t] = (int(r["x"]), int(r["y"]), int(r["z"]))
    ts = sorted(kept)
    return {
        "t": delta(ts),
        "x": delta([kept[t][0] for t in ts]),
        "y": delta([kept[t][1] for t in ts]),
        "z": delta([kept[t][2] for t in ts]),
    }


def telemetry_columns(rows: list[dict], t0, t1) -> dict:
    """car_data channels; a null DRS reading is stored as -1, never guessed."""
    kept: dict[int, tuple[int, ...]] = {}
    for r in rows:
        t = ms(r["date"], t0)
        if 0 <= t <= (t1 - t0).total_seconds() * 1000:
            kept[t] = (
                int(r.get("speed") or 0), int(r.get("rpm") or 0), int(r.get("n_gear") or 0),
                int(r.get("throttle") or 0), int(r.get("brake") or 0),
                -1 if r.get("drs") is None else int(r["drs"]),
            )
    ts = sorted(kept)
    cols = list(zip(*(kept[t] for t in ts))) if ts else [()] * 6
    names = ("speed", "rpm", "gear", "throttle", "brake", "drs")
    return {"t": delta(ts), **{n: list(c) for n, c in zip(names, cols)}}


def load_rows(directory: Path) -> list[dict]:
    rows: list[dict] = []
    # One window size only (the largest present, i.e. the current default), so a re-fetch at
    # another size is never double counted.
    sizes = sorted((d for d in directory.glob("*m") if d.is_dir()), key=lambda d: int(d.name[:-1]))
    folder = sizes[-1] if sizes else directory
    for path in sorted(folder.glob("*.json.gz")):
        rows.extend(read_cache(path)["rows"])
    return rows


def session_window(session: dict, laps: list[dict]):
    """Replay window: session clock with margins, stretched to cover every timed lap."""
    t0 = parse_time(session["date_start"]) - timedelta(minutes=5)
    t1 = parse_time(session["date_end"]) + timedelta(minutes=3)
    starts = [parse_time(l["date_start"]) for l in laps if l.get("date_start")]
    ends = [parse_time(l["date_start"]) + timedelta(seconds=l["lap_duration"]) for l in laps if l.get("date_start") and l.get("lap_duration")]
    if starts:
        t0 = min(t0, min(starts) - timedelta(minutes=2))
    if ends:
        t1 = max(t1, max(ends) + timedelta(minutes=2))
    return t0, t1


def compact_events(session_dir: Path, t0, t1) -> dict:
    def rows(name: str) -> list[dict]:
        path = session_dir / f"{name}.json.gz"
        return read_cache(path)["rows"] if path.exists() else []

    def inside(r: dict) -> bool:
        return r.get("date") is None or 0 <= ms(r["date"], t0) <= (t1 - t0).total_seconds() * 1000

    laps = [{
        "d": l["driver_number"], "n": l["lap_number"],
        "t": ms(l["date_start"], t0) if l.get("date_start") else None,
        "dur": l.get("lap_duration"), "s1": l.get("duration_sector_1"),
        "s2": l.get("duration_sector_2"), "s3": l.get("duration_sector_3"),
        "pitOut": bool(l.get("is_pit_out_lap")),
    } for l in rows("laps")]
    intervals = [{
        "d": r["driver_number"], "t": ms(r["date"], t0),
        "gap": r.get("gap_to_leader"), "int": r.get("interval"),
    } for r in load_rows(session_dir / "intervals") if inside(r)]
    return {
        "laps": laps,
        "stints": [{"d": s["driver_number"], "n": s["stint_number"], "lapStart": s.get("lap_start"), "lapEnd": s.get("lap_end"), "compound": s.get("compound"), "ageStart": s.get("tyre_age_at_start")} for s in rows("stints")],
        "pit": [{"d": p["driver_number"], "t": ms(p["date"], t0), "lap": p.get("lap_number"), "lane": p.get("lane_duration"), "stop": p.get("stop_duration")} for p in rows("pit") if inside(p)],
        "position": [{"d": p["driver_number"], "t": ms(p["date"], t0), "p": p["position"]} for p in rows("position")],
        "intervals": sorted(intervals, key=lambda r: (r["t"], r["d"])),
        "raceControl": [{"t": ms(r["date"], t0), "lap": r.get("lap_number"), "category": r.get("category"), "flag": r.get("flag"), "scope": r.get("scope"), "sector": r.get("sector"), "d": r.get("driver_number"), "message": r.get("message")} for r in rows("race_control")],
        "weather": [{"t": ms(w["date"], t0), "air": w.get("air_temperature"), "track": w.get("track_temperature"), "rain": w.get("rainfall"), "humidity": w.get("humidity"), "wind": w.get("wind_speed")} for w in rows("weather")],
        "result": rows("session_result"),
        "grid": rows("starting_grid"),
    }


def write_json(path: Path, data: dict) -> tuple[int, int]:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    path.write_bytes(text)
    return len(text), len(gzip.compress(text, 9))


def build_session(meeting: int, session: dict) -> dict:
    key = session["session_key"]
    source = ROOT / "data/raw/openf1" / str(meeting) / str(key)
    slug = SLUGS.get(session["session_name"], str(key))
    out = ROOT / "public/sessions" / str(meeting) / slug
    drivers = [driver_identity(r) for r in read_cache(source / "drivers.json.gz")["rows"]]
    laps = read_cache(source / "laps.json.gz")["rows"] if (source / "laps.json.gz").exists() else []
    t0, t1 = session_window(session, laps)
    provenance = json.loads((source / "provenance.json").read_text(encoding="utf-8"))
    sizes = {"raw": 0, "gzip": 0}
    for d in drivers:
        number = d["driver_number"]
        payload = {
            "number": number,
            "location": location_columns(load_rows(source / "location" / str(number)), t0, t1),
            "telemetry": telemetry_columns(load_rows(source / "car_data" / str(number)), t0, t1),
        }
        raw, gz = write_json(out / "drivers" / f"{number}.json", payload)
        sizes["raw"] += raw
        sizes["gzip"] += gz
    meta = {
        "schemaVersion": SCHEMA_VERSION,
        "source": "openf1",
        "attribution": ATTRIBUTION,
        "label": "Recorded session · interpolated motion · data via OpenF1",
        "meetingKey": meeting,
        "sessionKey": key,
        "sessionName": session["session_name"],
        "slug": slug,
        "t0": t0.isoformat(timespec="milliseconds"),
        "durationMs": round((t1 - t0).total_seconds() * 1000),
        "units": {"location": "OpenF1 circuit frame (units measured in alignment, Step 3)", "time": "ms since t0"},
        "drivers": drivers,
        **compact_events(source, t0, t1),
        "provenance": {k: provenance[k] for k in ("retrieved_first", "retrieved_last", "row_counts", "endpoint_urls", "requests")},
    }
    raw, gz = write_json(out / "session.json", meta)
    sizes["raw"] += raw
    sizes["gzip"] += gz
    return {"slug": slug, "drivers": len(drivers), "minutes": round((t1 - t0).total_seconds() / 60, 1), **sizes, "withinBudget": sizes["gzip"] <= BUDGET_GZIP_BYTES}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--meeting", type=int, default=1308)
    args = parser.parse_args()
    sessions = read_cache(ROOT / "data/raw/openf1" / str(args.meeting) / "sessions.json.gz")["rows"]
    index = []
    for session in sessions:
        if not (ROOT / "data/raw/openf1" / str(args.meeting) / str(session["session_key"]) / "provenance.json").exists():
            print(f"skip {session['session_name']}: not fetched yet")
            continue
        report = build_session(args.meeting, session)
        index.append({"slug": report["slug"], "sessionKey": session["session_key"], "name": session["session_name"], "dateStart": session["date_start"]})
        print(f"{report['slug']:<11} {report['drivers']} drivers  {report['minutes']} min  raw {report['raw'] / 1e6:.1f} MB  gzip {report['gzip'] / 1e6:.2f} MB  {'OK' if report['withinBudget'] else 'OVER BUDGET'}")
    out = ROOT / "public/sessions" / str(args.meeting) / "index.json"
    out.write_text(json.dumps({"meetingKey": args.meeting, "attribution": ATTRIBUTION, "sessions": index}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

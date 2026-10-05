"""Shared helpers for the OpenF1 pipeline. Standard library only.

OpenF1 (https://openf1.org) is a free, unofficial API. It is not associated with
Formula 1; data is used here with attribution and provenance.
"""
from __future__ import annotations

import gzip
import json
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

BASE = "https://api.openf1.org/v1"
ATTRIBUTION = "Data via OpenF1 (unofficial, https://openf1.org). Not associated with Formula 1."
# Session-level endpoints fetched once per session.
SESSION_ENDPOINTS = (
    "drivers", "laps", "stints", "pit", "position", "race_control",
    "weather", "session_result", "starting_grid",
)
# Fetched per time window (intervals for all drivers; location/car_data per driver).
WINDOWED_ENDPOINTS = ("intervals",)
DRIVER_ENDPOINTS = ("location", "car_data")
ROOT = Path(__file__).resolve().parent.parent


def parse_time(value: str) -> datetime:
    """OpenF1 ISO time, with or without fraction, always timezone-aware UTC."""
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def windows(start: datetime, end: datetime, minutes: int) -> list[tuple[datetime, datetime]]:
    """Contiguous [a, b) windows covering start..end; the last one is clipped."""
    if end <= start or minutes <= 0:
        raise ValueError("Invalid window range")
    out, step, a = [], timedelta(minutes=minutes), start
    while a < end:
        b = min(a + step, end)
        out.append((a, b))
        a = b
    return out


def url(endpoint: str, params: dict[str, object], window: tuple[datetime, datetime] | None = None) -> str:
    """Query URL. OpenF1 date filters use bare >= / < operators in the query string."""
    parts = [f"{k}={quote(str(v))}" for k, v in params.items()]
    if window:
        parts += [f"date>={iso(window[0])}", f"date<{iso(window[1])}"]
    return f"{BASE}/{endpoint}?" + "&".join(parts)


def parse_body(status: int, body: bytes) -> list[dict]:
    """Rows from a response. OpenF1 answers an empty query with 404 {"detail": "No results found."}."""
    if status == 404:
        try:
            if json.loads(body).get("detail") == "No results found.":
                return []
        except (ValueError, AttributeError):
            pass
        raise RuntimeError("Unexpected 404")
    data = json.loads(body)
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected payload: {str(data)[:120]}")
    return data


class RateLimiter:
    """At most `rate` requests per `per` seconds across threads (sliding window)."""

    # OpenF1 publishes 30 requests per 10 s, but sustained downloads drew HTTP 429 above
    # roughly 20-30 requests per minute (measured 2026-10-05), so the default is per minute.
    def __init__(self, rate: int = 25, per: float = 60.0) -> None:
        self.rate, self.per = rate, per
        self.stamps: list[float] = []
        self.lock = threading.Lock()

    def wait(self) -> None:
        while True:
            with self.lock:
                now = time.monotonic()
                self.stamps = [t for t in self.stamps if now - t < self.per]
                if len(self.stamps) < self.rate:
                    self.stamps.append(now)
                    return
                delay = self.per - (now - self.stamps[0]) + 0.01
            time.sleep(delay)


def fetch(address: str, limiter: RateLimiter, retries: int = 6) -> tuple[list[dict], str]:
    """GET with throttling and exponential backoff on 429/5xx/network errors."""
    for attempt in range(retries):
        limiter.wait()
        try:
            request = Request(address, headers={"User-Agent": "sepang-vision-lab/0.1 (offline replay)"})
            with urlopen(request, timeout=60) as response:
                return parse_body(response.status, response.read()), iso(datetime.now(timezone.utc))
        except HTTPError as error:
            if error.code == 404:
                return parse_body(404, error.read()), iso(datetime.now(timezone.utc))
            if error.code not in (429, 500, 502, 503, 504):
                raise
            reason = f"HTTP {error.code}"
        except (URLError, TimeoutError, ConnectionError, OSError) as error:
            reason = type(error).__name__ + ": " + str(error)[:80]
        # A 429 means "wait for the next window": back off from 15 s rather than 2 s.
        wait = min(120, (15 if reason == "HTTP 429" else 2) * 2 ** attempt)
        print(f"  retry {attempt + 1}/{retries} in {wait}s ({reason}) {address[len(BASE):][:90]}", flush=True)
        time.sleep(wait)
    raise RuntimeError(f"Gave up after {retries} attempts: {address}")


def write_cache(path: Path, rows: list[dict], meta: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with gzip.open(tmp, "wt", encoding="utf-8") as handle:
        json.dump({"meta": meta, "rows": rows}, handle, separators=(",", ":"))
    tmp.replace(path)  # atomic: an interrupted run never leaves a half-written cache file


def read_cache(path: Path) -> dict:
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        return json.load(handle)

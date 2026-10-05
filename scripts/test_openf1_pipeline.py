import json
import sys
import tempfile
import threading
import time
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from openf1_common import (  # noqa: E402
    RateLimiter, parse_body, parse_time, read_cache, url, windows, write_cache,
)


class PipelineTest(unittest.TestCase):
    def test_parse_time_handles_fraction_offset_and_z(self):
        a = parse_time("2026-10-04T07:10:00.098000+00:00")
        self.assertEqual(a.microsecond, 98000)
        self.assertEqual(parse_time("2026-10-04T07:10:00Z").tzinfo, timezone.utc)
        self.assertEqual(parse_time("2026-10-04T15:10:00+08:00").hour, 7)

    def test_windows_cover_range_without_gaps(self):
        a = datetime(2026, 10, 4, 6, 0, tzinfo=timezone.utc)
        w = windows(a, a + timedelta(minutes=25), 10)
        self.assertEqual(len(w), 3)
        self.assertEqual(w[0][0], a)
        for (x, y), (z, _) in zip(w, w[1:]):
            self.assertEqual(y, z)
        self.assertEqual(w[-1][1], a + timedelta(minutes=25))
        with self.assertRaises(ValueError):
            windows(a, a, 10)

    def test_url_uses_half_open_date_filters(self):
        a = datetime(2026, 10, 4, 7, 0, tzinfo=timezone.utc)
        u = url("location", {"session_key": 11731, "driver_number": 1}, (a, a + timedelta(minutes=10)))
        self.assertIn("session_key=11731&driver_number=1", u)
        self.assertIn("date>=2026-10-04T07:00:00&date<2026-10-04T07:10:00", u)

    def test_empty_query_404_is_an_empty_list(self):
        self.assertEqual(parse_body(404, b'{"detail":"No results found."}'), [])
        with self.assertRaises(RuntimeError):
            parse_body(404, b'{"detail":"Not found"}')
        with self.assertRaises(RuntimeError):
            parse_body(200, b'{"error":"x"}')
        self.assertEqual(parse_body(200, b'[{"x":1}]'), [{"x": 1}])

    def test_cache_round_trip_is_atomic(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "a" / "b.json.gz"
            write_cache(p, [{"x": 1}], {"rows": 1})
            self.assertEqual(read_cache(p), {"meta": {"rows": 1}, "rows": [{"x": 1}]})
            self.assertFalse(p.with_suffix(".tmp").exists())

    def test_rate_limiter_caps_burst(self):
        limiter = RateLimiter(rate=5, per=0.5)
        start = time.monotonic()
        threads = [threading.Thread(target=limiter.wait) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertGreaterEqual(time.monotonic() - start, 0.45)



class BuildTest(unittest.TestCase):
    def setUp(self):
        from build_recorded_session import (  # noqa: E402
            delta, driver_identity, location_columns, session_window, telemetry_columns, undelta,
        )
        self.delta, self.undelta = delta, undelta
        self.identity, self.loc, self.tel, self.window = driver_identity, location_columns, telemetry_columns, session_window
        self.t0 = datetime(2026, 10, 4, 7, 0, tzinfo=timezone.utc)
        self.t1 = self.t0 + timedelta(minutes=1)

    def test_delta_round_trip(self):
        values = [5, 7, 7, -3, 1000, 2]
        self.assertEqual(self.undelta(self.delta(values)), values)
        self.assertEqual(self.delta([]), [])

    def test_identity_never_copies_headshots(self):
        row = {"driver_number": 1, "name_acronym": "AAA", "headshot_url": "https://media.formula1.com/x.png", "team_colour": "F47600"}
        out = self.identity(row)
        self.assertNotIn("headshot_url", out)
        self.assertEqual(out["team_colour"], "F47600")

    def test_location_drops_no_fix_sorts_dedupes_and_trims(self):
        rows = [
            {"date": "2026-10-04T07:00:02+00:00", "x": 3, "y": 4, "z": 5},
            {"date": "2026-10-04T07:00:01+00:00", "x": 1, "y": 2, "z": 3},
            {"date": "2026-10-04T07:00:01+00:00", "x": 1, "y": 2, "z": 3},
            {"date": "2026-10-04T07:00:03+00:00", "x": 0, "y": 0, "z": 0},
            {"date": "2026-10-04T06:59:00+00:00", "x": 9, "y": 9, "z": 9},
        ]
        c = self.loc(rows, self.t0, self.t1)
        self.assertEqual(self.undelta(c["t"]), [1000, 2000])
        self.assertEqual(self.undelta(c["x"]), [1, 3])

    def test_telemetry_keeps_null_drs_as_unknown(self):
        rows = [{"date": "2026-10-04T07:00:00.5+00:00", "speed": 290, "rpm": 11000, "n_gear": 7, "throttle": 100, "brake": 0, "drs": None}]
        c = self.tel(rows, self.t0, self.t1)
        self.assertEqual((c["t"], c["speed"], c["gear"], c["drs"]), ([500], [290], [7], [-1]))
        self.assertEqual(self.tel([], self.t0, self.t1)["speed"], [])

    def test_window_stretches_to_cover_laps(self):
        session = {"date_start": "2026-10-04T07:00:00+00:00", "date_end": "2026-10-04T09:00:00+00:00"}
        laps = [{"date_start": "2026-10-04T09:10:00+00:00", "lap_duration": 100.0}]
        a, b = self.window(session, laps)
        self.assertEqual(a, datetime(2026, 10, 4, 6, 55, tzinfo=timezone.utc))
        self.assertEqual(b, datetime(2026, 10, 4, 9, 13, 40, tzinfo=timezone.utc))


if __name__ == "__main__":
    unittest.main()

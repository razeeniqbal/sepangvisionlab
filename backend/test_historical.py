import unittest
from fastapi.testclient import TestClient
from .main import app
from .historical import historical_replay

class HistoricalTests(unittest.TestCase):
    def test_cached_replay_contract(self):
        response=TestClient(app).get("/api/v2/sessions/malaysia-2017/replay")
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertEqual(data["source"],"historical-lap-timing")
        self.assertEqual(len(data["drivers"]),20)
        self.assertEqual(sum(len(d["timing"]) for d in data["drivers"]),1024)
        self.assertEqual(sum(len(d["pits"]) for d in data["drivers"]),20)
    def test_original_race_identity_and_winner_duration(self):
        data=historical_replay()
        winner=next(d for d in data.drivers if d.classification==1)
        self.assertEqual(winner.id,"max_verstappen")
        self.assertEqual(winner.number,"33")
        self.assertEqual(winner.team,"Red Bull")
        self.assertAlmostEqual(winner.timing[-1].endTime,5401.290,places=3)
    def test_nonstarter_and_retirement_not_padded(self):
        data=historical_replay()
        kimi=next(d for d in data.drivers if d.id=="raikkonen")
        sainz=next(d for d in data.drivers if d.id=="sainz")
        self.assertEqual(kimi.timing,[])
        self.assertEqual(len(sainz.timing),29)
        self.assertEqual(sainz.status,"Engine")
    def test_lap_sequences_and_cumulative_times(self):
        for driver in historical_replay().drivers:
            total=0
            for index,lap in enumerate(driver.timing,1):
                total+=lap.seconds
                self.assertEqual(lap.lap,index)
                self.assertAlmostEqual(total,lap.endTime,places=3)

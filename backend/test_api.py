import unittest
from fastapi.testclient import TestClient
from .main import app
from .provider import state_at

class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_and_normalized_state(self):
        self.assertEqual(self.client.get("/api/health").json()["status"], "ok")
        data = self.client.get("/api/v1/session/state?time=120").json()
        self.assertEqual(data["source"], "synthetic")
        self.assertEqual(data["time"], 120)
        self.assertEqual(len(data["cars"]), 20)
        self.assertEqual(sorted(car["position"] for car in data["cars"]), list(range(1,21)))
        self.assertEqual(data["cars"][0]["completedLaps"], 1)
        self.assertEqual(data["cars"][0]["progress"], 0)

    def test_invalid_times_rejected(self):
        for value in ["-1", "601", "nan", "inf", "abc"]:
            with self.subTest(value=value):
                self.assertEqual(self.client.get('/api/v1/session/state',params={"time":value}).status_code,422)

    def test_replay_has_complete_ordered_states(self):
        response=self.client.get("/api/v1/session/replay")
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertEqual(len(data["frames"]),601)
        ids=[entry["id"] for entry in data["entries"]]
        for time,frame in enumerate(data["frames"]):
            self.assertEqual(frame["time"],time)
            self.assertEqual([car["id"] for car in frame["cars"]],ids)
            self.assertTrue(all(0<=car["progress"]<1 for car in frame["cars"]))

    def test_requests_are_stateless(self):
        before=state_at(0).model_dump()
        state_at(600)
        self.assertEqual(state_at(0).model_dump(),before)

if __name__ == "__main__": unittest.main()

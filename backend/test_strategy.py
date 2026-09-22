import unittest
from unittest.mock import patch
from pydantic import ValidationError
from fastapi.testclient import TestClient
from .main import app
from .historical import historical_replay
from .strategy import Assumptions, StrategyRequest, project_plan, compare_strategy

class StrategyTests(unittest.TestCase):
    def test_hand_calculated_two_lap_plans_and_single_pit_charge(self):
        a=Assumptions(currentDegradation=1,freshDegradation=.5,freshPaceDelta=-2,pitLoss=10)
        stay=project_plan(100,54,1000,None,a,"stay","Stay")
        now=project_plan(100,54,1000,54,a,"now","Now")
        later=project_plan(100,54,1000,55,a,"later","Later")
        self.assertEqual(stay.remainingSeconds,201)
        self.assertEqual(now.remainingSeconds,206.5)
        self.assertEqual(later.remainingSeconds,208)
        self.assertEqual(now.finishTime,1206.5)
        self.assertEqual(sum(l.pit for l in now.laps),1)
        self.assertEqual(sum(l.pit for l in later.laps),1)
        self.assertEqual([l.lap for l in later.laps],[55,56])

    def test_equal_pace_zero_cost_produces_equal_plans(self):
        a=Assumptions(currentDegradation=0,freshDegradation=0,pitLoss=0)
        values=[project_plan(100,30,0,pit,a,identity,identity).remainingSeconds for pit,identity in [(None,"stay"),(30,"now"),(33,"later")]]
        self.assertEqual(values,[2600,2600,2600])

    def test_penalties_and_compound_label_are_explicit(self):
        a=Assumptions(currentDegradation=0,freshDegradation=0,pitLoss=0,trafficPenalty=1,weather="custom",weatherPenalty=2)
        now=project_plan(100,54,0,54,a,"now","Now")
        stay=project_plan(100,54,0,None,a,"stay","Stay")
        self.assertEqual(now.remainingSeconds,206)
        self.assertEqual(stay.remainingSeconds,204)
        a.compound="SOFT"
        self.assertEqual(project_plan(100,54,0,54,a,"now","Now").remainingSeconds,206)

    def test_branch_uses_only_completed_laps(self):
        request=StrategyRequest(driverId="max_verstappen",completedLaps=10,delayedPitLap=13)
        original=compare_strategy(request)
        data=historical_replay().model_copy(deep=True)
        for driver in data.drivers:
            for lap in driver.timing[10:]:lap.seconds=999
            driver.pits=[pit for pit in driver.pits if pit.lap<=10]
        with patch("backend.strategy.historical_replay",return_value=data):changed=compare_strategy(request)
        self.assertEqual(original.model_dump(),changed.model_dump())
        self.assertEqual(original.baselineLaps,[8,9,10])

    def test_validation_and_driver_coverage(self):
        with self.assertRaises(ValidationError):StrategyRequest(driverId="x",completedLaps=30,delayedPitLap=30)
        with self.assertRaises(ValidationError):Assumptions(pitLoss=-1)
        with self.assertRaises(ValidationError):Assumptions(weatherPenalty=2)
        with self.assertRaises(ValidationError):Assumptions(currentDegradation=float("nan"))
        with self.assertRaises(ValueError):compare_strategy(StrategyRequest(driverId="raikkonen",completedLaps=1))
        with self.assertRaises(ValueError):compare_strategy(StrategyRequest(driverId="max_verstappen",completedLaps=3))
        with self.assertRaises(ValueError):compare_strategy(StrategyRequest(driverId="sainz",completedLaps=29))

    def test_api_returns_reconciled_hypothetical_comparison(self):
        client=TestClient(app)
        response=client.post("/api/v1/strategy/compare",json={"driverId":"max_verstappen","completedLaps":30,"delayedPitLap":33})
        self.assertEqual(response.status_code,200)
        data=response.json();self.assertEqual(data["source"],"assumption-based-simulation")
        self.assertEqual(len(data["plans"]),3)
        stay=data["plans"][0]["remainingSeconds"]
        for plan in data["plans"]:
            self.assertAlmostEqual(sum(l["seconds"] for l in plan["laps"]),plan["remainingSeconds"])
            self.assertAlmostEqual(plan["remainingSeconds"]-stay,plan["deltaToStay"])
        self.assertEqual(client.post("/api/v1/strategy/compare",json={"driverId":"missing","completedLaps":30}).status_code,404)

import unittest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from .main import app
from .monte_carlo import MonteCarloRequest,Uncertainty,simulate
from .strategy import StrategyRequest,Assumptions

class MonteCarloTests(unittest.TestCase):
    def request(self,**kwargs):
        return MonteCarloRequest(strategy=StrategyRequest(driverId="max_verstappen",completedLaps=30,delayedPitLap=33),runs=1000,**kwargs)

    def test_seed_reproducibility(self):
        first=simulate(self.request(seed=42)).model_dump()
        self.assertEqual(first,simulate(self.request(seed=42)).model_dump())
        self.assertNotEqual(first["plans"],simulate(self.request(seed=43)).model_dump()["plans"])

    def test_zero_uncertainty_matches_deterministic_plans(self):
        result=simulate(self.request(uncertainty=Uncertainty(paceSd=0,degradationSd=0,pitSd=0,trafficSd=0)))
        for plan,deterministic in zip(result.plans,result.strategy.plans):
            self.assertAlmostEqual(plan.remaining.mean,deterministic.remainingSeconds,places=8)
            self.assertAlmostEqual(plan.remaining.sd,0,places=8)
            self.assertAlmostEqual(plan.delta.p50,deterministic.deltaToStay,places=8)

    def test_equal_plans_split_ties_without_order_bias(self):
        request=self.request(uncertainty=Uncertainty(paceSd=1,degradationSd=0,pitSd=0,trafficSd=0))
        request.strategy.assumptions=Assumptions(currentDegradation=0,freshDegradation=0,pitLoss=0)
        result=simulate(request)
        for plan in result.plans:
            self.assertAlmostEqual(plan.fastestShare,1/3)
            self.assertEqual(plan.beatsStay,0)
            self.assertAlmostEqual(plan.delta.sd,0)

    def test_histograms_and_probabilities_reconcile(self):
        result=simulate(self.request())
        self.assertAlmostEqual(sum(p.fastestShare for p in result.plans),1)
        for plan in result.plans:
            self.assertEqual(sum(b.count for b in plan.histogram),result.runs)
            self.assertEqual(len(plan.histogram),20)
            self.assertLessEqual(plan.remaining.p10,plan.remaining.p50)
            self.assertLessEqual(plan.remaining.p50,plan.remaining.p90)
        self.assertEqual(result.plans[0].beatsStay,0)

    def test_paired_pace_noise_cancels_in_deltas(self):
        quiet=simulate(self.request(uncertainty=Uncertainty(paceSd=0,degradationSd=0,pitSd=0,trafficSd=0)))
        noisy=simulate(self.request(uncertainty=Uncertainty(paceSd=2,degradationSd=0,pitSd=0,trafficSd=0)))
        for a,b in zip(quiet.plans,noisy.plans):
            self.assertAlmostEqual(a.delta.p50,b.delta.p50,places=8)
            self.assertGreater(b.remaining.sd,a.remaining.sd)

    def test_full_run_limit_and_final_lap(self):
        request=self.request();request.runs=10000;request.strategy=StrategyRequest(driverId="max_verstappen",completedLaps=55)
        result=simulate(request)
        self.assertEqual(len(result.plans),2)
        self.assertEqual(sum(b.count for b in result.plans[1].histogram),10000)

    def test_api_and_input_bounds(self):
        client=TestClient(app);request=self.request().model_dump()
        self.assertEqual(client.post("/api/v1/strategy/monte-carlo",json=request).status_code,200)
        for runs in [999,10001,True,1.5]:
            self.assertEqual(client.post("/api/v1/strategy/monte-carlo",json={**request,"runs":runs}).status_code,422)
        with self.assertRaises(ValidationError):Uncertainty(paceSd=float("nan"))
        with self.assertRaises(ValidationError):self.request(seed=-1)

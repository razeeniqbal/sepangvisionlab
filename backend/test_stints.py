import unittest
from fastapi.testclient import TestClient
from .main import app
from .historical import historical_replay
from .stint_analysis import StintSample,fit_pace,analyze_driver

class StintTests(unittest.TestCase):
    def driver(self,identity="max_verstappen"):
        return next(d for d in historical_replay().drivers if d.id==identity)

    def samples(self,slope):
        return [StintSample(lap=i,seconds=90+slope*i,included=True,reason="included") for i in range(1,7)]

    def test_known_positive_negative_flat_slopes(self):
        for slope in [.2,-.1,0]:
            fit=fit_pace(self.samples(slope))
            self.assertAlmostEqual(fit.secondsPerLap,slope,places=10)
            self.assertAlmostEqual(fit.intercept,90,places=10)
            self.assertAlmostEqual(fit.fitMae,0,places=10)

    def test_minimum_data_and_outlier_resistance(self):
        self.assertIsNone(fit_pace(self.samples(.1)[:4]))
        samples=self.samples(.1)
        samples[2].seconds+=50
        self.assertAlmostEqual(fit_pace(samples).secondsPerLap,.1,places=10)
        self.assertGreater(fit_pace(samples).fitMae,0)

    def test_pit_boundaries_and_exclusions(self):
        report=analyze_driver(self.driver(),32)
        self.assertEqual(len(report.stints),2)
        first,second=report.stints
        self.assertEqual((first.startLap,first.endLap),(1,27))
        self.assertEqual((second.startLap,second.endLap),(28,32))
        self.assertEqual(first.samples[0].reason,"opening lap")
        self.assertEqual(first.samples[-1].reason,"pit lap")
        self.assertEqual(second.samples[0].reason,"lap after pit")
        self.assertIsNone(second.fit)
        self.assertIsNotNone(analyze_driver(self.driver(),33).stints[1].fit)

    def test_no_future_laps_or_pit_boundaries(self):
        driver=self.driver().model_copy(deep=True)
        before=analyze_driver(driver,10).model_dump()
        for lap in driver.timing[10:]:lap.seconds=999
        driver.pits=[]
        self.assertEqual(analyze_driver(driver,10).model_dump(),before)
        self.assertEqual(len(before["stints"]),1)
        self.assertEqual(before["stints"][0]["endLap"],10)

    def test_unknown_tyres_and_nonstarter(self):
        report=analyze_driver(self.driver(),56)
        self.assertTrue(all(s.compound is None and s.tyreAge is None for s in report.stints))
        self.assertEqual(analyze_driver(self.driver("raikkonen"),0).stints,[])
        with self.assertRaises(ValueError):analyze_driver(self.driver("sainz"),30)

    def test_api_validation_and_empty_new_segment(self):
        client=TestClient(app)
        response=client.get("/api/v1/analysis/stints",params={"driver_id":"max_verstappen","completed_laps":27})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()["stints"][-1]["samples"],[])
        for value in [-1,57,2.5]:self.assertEqual(client.get("/api/v1/analysis/stints",params={"driver_id":"max_verstappen","completed_laps":value}).status_code,422)
        self.assertEqual(client.get("/api/v1/analysis/stints",params={"driver_id":"missing"}).status_code,404)
        self.assertEqual(client.get("/api/v1/analysis/stints",params={"driver_id":"sainz","completed_laps":30}).status_code,422)

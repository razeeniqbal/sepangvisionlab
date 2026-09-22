import unittest
from fastapi.testclient import TestClient
from .main import app
from .lap_features import build_rows,features_at,TRAIN_END,VALIDATION_END
from .historical import historical_replay
from .lap_model import lap_report

class LapModelTests(unittest.TestCase):
    def test_split_observations_precede_future_predictions(self):
        rows=build_rows()
        train=[r for r in rows if r["split"]=="train"]
        validation=[r for r in rows if r["split"]=="validation"]
        test=[r for r in rows if r["split"]=="test"]
        self.assertEqual([len(train),len(validation),len(test)],[448,207,275])
        self.assertLessEqual(max(r["targetEnd"] for r in train),TRAIN_END)
        self.assertGreaterEqual(min(r["issuedAt"] for r in validation),TRAIN_END)
        self.assertLessEqual(max(r["targetEnd"] for r in validation),VALIDATION_END)
        self.assertGreaterEqual(min(r["issuedAt"] for r in test),VALIDATION_END)
        self.assertTrue(all(r["issuedAt"]<r["targetEnd"] for r in rows))

    def test_features_do_not_read_future_laps(self):
        driver=historical_replay().drivers[0].model_copy(deep=True)
        original=features_at(driver,10)
        for lap in driver.timing[10:]:
            lap.seconds=999
            lap.position=20
        self.assertEqual(features_at(driver,10),original)
        self.assertEqual(original[:3],[driver.timing[9].seconds,driver.timing[8].seconds,driver.timing[7].seconds])
        with self.assertRaises(ValueError):features_at(driver,2)

    def test_selection_uses_validation_and_report_keeps_baseline_comparison(self):
        report=lap_report()
        best=min(report.models,key=lambda m:m.validation.mae)
        self.assertEqual(report.selectedModel,best.name)
        self.assertEqual(len(report.models),4)
        self.assertGreater(best.test.mae,report.models[0].test.mae)

    def test_published_forecasts_reproduce_report_test_errors(self):
        report=lap_report()
        drivers={d.id:d for d in historical_replay().drivers}
        errors=[]
        for forecast in report.forecasts:
            driver=drivers[forecast.driverId]
            self.assertEqual(forecast.previousLaps,features_at(driver,forecast.lap-1)[:3])
            self.assertEqual(forecast.issuedAt,driver.timing[forecast.lap-2].endTime)
            errors.append(abs(forecast.prediction-driver.timing[forecast.lap-1].seconds))
        selected=next(m for m in report.models if m.name==report.selectedModel)
        self.assertAlmostEqual(sum(errors)/len(errors),selected.test.mae,places=10)

    def test_report_api_contains_no_future_actual_targets(self):
        response=TestClient(app).get("/api/v1/ml/lap-times/report")
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertEqual(len(data["forecasts"]),275)
        self.assertTrue(all(f["issuedAt"]>=3900 and "target" not in f and "actual" not in f for f in data["forecasts"]))

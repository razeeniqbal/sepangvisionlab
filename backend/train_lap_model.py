"""Explicit reproducible experiment. HTTP requests never train models."""
import hashlib
import json
import platform
from datetime import datetime,timezone
from pathlib import Path
import joblib
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import sklearn
import xgboost
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error,root_mean_squared_error,r2_score
from xgboost import XGBRegressor
from .lap_features import build_rows,FEATURES,TRAIN_END,VALIDATION_END

ROOT=Path(__file__).parent/"data/lap-model-v1"
def metrics(actual,predicted):
    return dict(mae=float(mean_absolute_error(actual,predicted)),rmse=float(root_mean_squared_error(actual,predicted)),r2=float(r2_score(actual,predicted)))

def train():
    rows=build_rows()
    groups={split:[row for row in rows if row["split"]==split] for split in ["train","validation","test"]}
    def x(split):return np.array([[r[f] for f in FEATURES] for r in groups[split]])
    def y(split):return np.array([r["target"] for r in groups[split]])
    assert max(r["targetEnd"] for r in groups["train"])<=min(r["issuedAt"] for r in groups["validation"])
    assert max(r["targetEnd"] for r in groups["validation"])<=min(r["issuedAt"] for r in groups["test"])
    models={"Linear Regression":LinearRegression(),"Random Forest":RandomForestRegressor(n_estimators=200,max_depth=8,min_samples_leaf=5,random_state=42,n_jobs=1),"XGBoost":XGBRegressor(n_estimators=200,max_depth=3,learning_rate=.04,subsample=.9,colsample_bytree=1,objective="reg:squarederror",random_state=42,n_jobs=1)}
    predictions={"Previous-lap baseline":{split:x(split)[:,0] for split in ["validation","test"]}}
    for name,model in models.items():
        model.fit(x("train"),y("train"))
        predictions[name]={split:model.predict(x(split)) for split in ["validation","test"]}
    scores=[dict(name=name,validation=metrics(y("validation"),pred["validation"]),test=metrics(y("test"),pred["test"])) for name,pred in predictions.items()]
    selected=min(scores,key=lambda result:result["validation"]["mae"])["name"]
    forecasts=[dict(driverId=row["driverId"],lap=row["lap"],issuedAt=row["issuedAt"],prediction=float(predictions[selected]["test"][i]),baseline=row["previousLap1"],previousLaps=[row["previousLap1"],row["previousLap2"],row["previousLap3"]]) for i,row in enumerate(groups["test"])]
    source=Path(__file__).parent/"data/malaysia-2017/laps.parquet"
    report=dict(schemaVersion=1,sessionId="malaysia-2017",selectedModel=selected,selectionRule="Lowest validation MAE; test scores are never used for selection",trainEnd=TRAIN_END,validationEnd=VALIDATION_END,counts={**{key:len(value) for key,value in groups.items()},"excludedBoundary":sum(r["split"]=="excluded-boundary" for r in rows)},features=FEATURES,models=scores,forecasts=forecasts,createdAt=datetime.now(timezone.utc).isoformat(),sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),versions={"python":platform.python_version(),"sklearn":sklearn.__version__,"xgboost":xgboost.__version__},limitations="One race only. All recorded laps, including pit and slow laps, are retained. No tyre, weather, traffic or planned pit inputs. Scores are retrospective, not an uncertainty interval.")
    ROOT.mkdir(parents=True,exist_ok=True)
    pq.write_table(pa.Table.from_pylist(rows),ROOT/"features.parquet")
    joblib.dump(models,ROOT/"models.joblib",compress=3)
    (ROOT/"report.json").write_text(json.dumps(report,indent=2,allow_nan=False))
    print(json.dumps({"selected":selected,"counts":report["counts"],"metrics":scores},indent=2))
    return report

if __name__=="__main__":train()

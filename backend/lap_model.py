from functools import lru_cache
from pathlib import Path
import hashlib
import json
from typing import Literal
from pydantic import Field
from .models import Model

class Scores(Model):
    mae:float=Field(ge=0)
    rmse:float=Field(ge=0)
    r2:float
class ModelResult(Model):
    name:str
    validation:Scores
    test:Scores
class Forecast(Model):
    driverId:str
    lap:int=Field(ge=4)
    issuedAt:float=Field(ge=3900)
    prediction:float=Field(gt=0)
    baseline:float=Field(gt=0)
    previousLaps:list[float]
class LapReport(Model):
    schemaVersion:Literal[1]
    sessionId:Literal["malaysia-2017"]
    selectedModel:str
    selectionRule:str
    trainEnd:float
    validationEnd:float
    counts:dict[str,int]
    features:list[str]
    models:list[ModelResult]
    forecasts:list[Forecast]
    createdAt:str
    sourceSha256:str
    versions:dict[str,str]
    limitations:str

@lru_cache(maxsize=1)
def lap_report():
    root=Path(__file__).parent/"data"
    report=LapReport.model_validate(json.loads((root/"lap-model-v1/report.json").read_text()))
    if report.sourceSha256!=hashlib.sha256((root/"malaysia-2017/laps.parquet").read_bytes()).hexdigest():
        raise ValueError("Historical data changed; retrain the experiment")
    return report

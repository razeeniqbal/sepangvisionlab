from typing import Annotated
from fastapi import FastAPI, Query
from fastapi.middleware.gzip import GZipMiddleware
from .models import RaceState, Replay
from .provider import state_at, replay

app = FastAPI(title="Sepang Vision Lab", version="1.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.get("/api/health")
def health():
    return {"status": "ok", "schemaVersion": 1}

@app.get("/api/v1/session/state", response_model=RaceState)
def get_state(time: Annotated[float, Query(ge=0, le=600, allow_inf_nan=False)] = 0):
    return state_at(time)

@app.get("/api/v1/session/replay", response_model=Replay)
def get_replay():
    return replay()

from fastapi import HTTPException
from .historical import HistoricalReplay, historical_replay

@app.get("/api/v2/sessions/malaysia-2017/replay", response_model=HistoricalReplay)
def get_historical_replay():
    try:
        return historical_replay()
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Historical cache missing; run python -m backend.ingest_historical")

from .lap_model import LapReport, lap_report

@app.get("/api/v1/ml/lap-times/report", response_model=LapReport)
def get_lap_report():
    try:
        return lap_report()
    except (FileNotFoundError, ValueError):
        raise HTTPException(status_code=503, detail="Lap model unavailable; run python -m backend.train_lap_model")

from .stint_analysis import StintAnalysis, stint_analysis

@app.get("/api/v1/analysis/stints", response_model=StintAnalysis)
def get_stint_analysis(driver_id:str, completed_laps:Annotated[int,Query(ge=0,le=56)]=0):
    try:
        return stint_analysis(driver_id,completed_laps)
    except KeyError:
        raise HTTPException(status_code=404,detail="Unknown historical driver")
    except ValueError:
        raise HTTPException(status_code=422,detail="Completed laps outside driver timing coverage")
    except FileNotFoundError:
        raise HTTPException(status_code=503,detail="Historical cache unavailable")

from .strategy import StrategyRequest, StrategyResult, compare_strategy

@app.post("/api/v1/strategy/compare", response_model=StrategyResult)
def get_strategy_comparison(request:StrategyRequest):
    try:
        return compare_strategy(request)
    except KeyError:
        raise HTTPException(status_code=404,detail="Unknown historical driver")
    except ValueError as error:
        raise HTTPException(status_code=422,detail=str(error))
    except FileNotFoundError:
        raise HTTPException(status_code=503,detail="Historical cache unavailable")

from .monte_carlo import MonteCarloRequest, MonteCarloResult, simulate

@app.post("/api/v1/strategy/monte-carlo", response_model=MonteCarloResult)
def get_monte_carlo(request:MonteCarloRequest):
    try:
        return simulate(request)
    except KeyError:
        raise HTTPException(status_code=404,detail="Unknown historical driver")
    except ValueError as error:
        raise HTTPException(status_code=422,detail=str(error))
    except FileNotFoundError:
        raise HTTPException(status_code=503,detail="Historical cache unavailable")

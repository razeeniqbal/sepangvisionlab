"""Normalize cached Parquet records; no network access during replay."""
from functools import lru_cache
from pathlib import Path
from typing import Literal
import pyarrow.parquet as pq
from pydantic import Field
from .models import Model

ROOT=Path(__file__).parent/"data/malaysia-2017"
class Lap(Model):
    lap:int=Field(ge=1)
    position:int=Field(ge=1)
    seconds:float=Field(gt=0)
    endTime:float=Field(gt=0)
class Pit(Model):
    lap:int
    stop:int
    duration:float
class Driver(Model):
    id:str
    number:str
    name:str
    team:str
    teamId:str
    grid:int
    classification:int
    laps:int
    status:str
    timing:list[Lap]
    pits:list[Pit]
class HistoricalReplay(Model):
    schemaVersion:Literal[2]=2
    source:Literal["historical-lap-timing"]="historical-lap-timing"
    sessionId:Literal["malaysia-2017"]="malaysia-2017"
    title:str="2017 Malaysian Grand Prix"
    date:str="2017-10-01"
    circuitId:Literal["sepang"]="sepang"
    duration:float
    drivers:list[Driver]
    sourceUrl:str="https://api.jolpi.ca/ergast/f1/2017/15/"
    movementQuality:str="Linear reconstruction between completed laps; not GPS. Retirement locations and exact retirement times are unavailable."

@lru_cache(maxsize=1)
def historical_replay():
    entries=pq.read_table(ROOT/"entries.parquet").to_pylist()
    laps=pq.read_table(ROOT/"laps.parquet").to_pylist()
    pits=pq.read_table(ROOT/"pits.parquet").to_pylist()
    drivers=[]
    for entry in entries:
        timing=sorted(({k:v for k,v in lap.items() if k!="id"} for lap in laps if lap["id"]==entry["id"]),key=lambda lap:lap["lap"])
        assert len(timing)==entry["laps"]
        drivers.append(Driver(**entry,timing=timing,pits=[{k:v for k,v in pit.items() if k!="id"} for pit in pits if pit["id"]==entry["id"]]))
    return HistoricalReplay(duration=max(lap["endTime"] for lap in laps),drivers=drivers)

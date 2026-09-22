"""Observed pace trends, not isolated tyre degradation. No future completed laps."""
from statistics import median
from functools import lru_cache
from typing import Literal
from pydantic import Field
from .models import Model
from .historical import Driver, historical_replay

MIN_SAMPLES=5
class StintSample(Model):
    lap:int=Field(ge=1)
    seconds:float=Field(gt=0)
    included:bool
    reason:Literal["included","opening lap","pit lap","lap after pit"]
class PaceFit(Model):
    method:Literal["median pairwise slopes"]="median pairwise slopes"
    secondsPerLap:float
    intercept:float
    fitMae:float=Field(ge=0)
    firstLap:int
    lastLap:int
    sampleCount:int=Field(ge=5)
class Stint(Model):
    number:int=Field(ge=1)
    startLap:int=Field(ge=1)
    endLap:int=Field(ge=0)
    boundary:Literal["race start","recorded pit stop"]
    compound:None=None
    tyreAge:None=None
    samples:list[StintSample]
    fit:PaceFit|None
class StintAnalysis(Model):
    schemaVersion:Literal[1]=1
    sessionId:Literal["malaysia-2017"]="malaysia-2017"
    source:Literal["historical-lap-timing"]="historical-lap-timing"
    driverId:str
    completedLaps:int=Field(ge=0)
    minSamples:int=MIN_SAMPLES
    stints:list[Stint]
    limitation:str="Pit-stop boundaries are stint proxies, not confirmed tyre changes. Fuel burn, traffic and track conditions also affect pace. Compound, true tyre age and isolated tyre wear are unavailable."

def fit_pace(samples:list[StintSample]):
    kept=[sample for sample in samples if sample.included]
    if len(kept)<MIN_SAMPLES:return None
    slopes=[(b.seconds-a.seconds)/(b.lap-a.lap) for i,a in enumerate(kept) for b in kept[i+1:] if b.lap>a.lap]
    if not slopes:return None
    slope=median(slopes)
    intercept=median(sample.seconds-slope*sample.lap for sample in kept)
    mae=sum(abs(sample.seconds-(intercept+slope*sample.lap)) for sample in kept)/len(kept)
    return PaceFit(secondsPerLap=slope,intercept=intercept,fitMae=mae,firstLap=kept[0].lap,lastLap=kept[-1].lap,sampleCount=len(kept))

def analyze_driver(driver:Driver,completed:int):
    if completed<0 or completed>driver.laps:raise ValueError("Completed laps outside driver timing coverage")
    # A pit is admitted only once its containing lap has completed.
    pits={pit.lap for pit in driver.pits if pit.lap<=completed}
    starts=[1]+[lap+1 for lap in sorted(pits) if lap<driver.laps]
    stints=[]
    for i,start in enumerate(starts):
        end=min(completed,starts[i+1]-1 if i+1<len(starts) else completed)
        samples=[]
        for lap in driver.timing:
            if not start<=lap.lap<=end:continue
            reason="opening lap" if lap.lap==1 else "pit lap" if lap.lap in pits else "lap after pit" if lap.lap-1 in pits else "included"
            samples.append(StintSample(lap=lap.lap,seconds=lap.seconds,included=reason=="included",reason=reason))
        stints.append(Stint(number=i+1,startLap=start,endLap=end,boundary="race start" if i==0 else "recorded pit stop",samples=samples,fit=fit_pace(samples)))
    return StintAnalysis(driverId=driver.id,completedLaps=completed,stints=stints if driver.laps else [])

@lru_cache(maxsize=128)
def stint_analysis(driver_id:str,completed:int):
    driver=next((d for d in historical_replay().drivers if d.id==driver_id),None)
    if driver is None:raise KeyError(driver_id)
    return analyze_driver(driver,completed)

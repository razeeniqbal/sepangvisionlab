"""Deterministic what-if branches; explicit assumptions, no historical future targets."""
from typing import Literal
from statistics import median
from pydantic import Field, model_validator
from .models import Model
from .historical import historical_replay

class Assumptions(Model):
    currentDegradation:float=Field(default=.05,ge=0,le=2)
    freshDegradation:float=Field(default=.05,ge=0,le=2)
    freshPaceDelta:float=Field(default=0,ge=-10,le=10)
    pitLoss:float=Field(default=22,ge=0,le=120)
    trafficPenalty:float=Field(default=0,ge=0,le=10)
    compound:Literal["SOFT","MEDIUM","HARD"]="HARD"
    weather:Literal["dry","custom"]="dry"
    weatherPenalty:float=Field(default=0,ge=0,le=60)
    @model_validator(mode="after")
    def dry_weather(self):
        if self.weather=="dry" and self.weatherPenalty!=0:raise ValueError("Dry scenario requires zero weather penalty")
        return self

class StrategyRequest(Model):
    driverId:str
    completedLaps:int=Field(ge=1,le=55)
    delayedPitLap:int|None=Field(default=None,ge=1,le=55)
    assumptions:Assumptions=Field(default_factory=Assumptions)
    @model_validator(mode="after")
    def pit_after_branch(self):
        if self.delayedPitLap is not None and self.delayedPitLap<=self.completedLaps:raise ValueError("Delayed pit lap must follow branch lap")
        return self

class ProjectionLap(Model):
    lap:int
    seconds:float
    cumulative:float
    pit:bool
class Plan(Model):
    id:Literal["stay","now","later"]
    label:str
    pitLap:int|None
    compound:str
    remainingSeconds:float
    finishTime:float
    deltaToStay:float=0
    laps:list[ProjectionLap]
class StrategyResult(Model):
    schemaVersion:Literal[1]=1
    source:Literal["assumption-based-simulation"]="assumption-based-simulation"
    driverId:str
    driverName:str
    branchLap:int
    branchTime:float
    finishLap:int=56
    baselineSeconds:float
    baselineLaps:list[int]
    assumptions:Assumptions
    plans:list[Plan]
    fastestPlan:str

def project_plan(base:float,branch_lap:int,branch_time:float,pit_lap:int|None,assumptions:Assumptions,identity:str,label:str):
    total=0;rows=[]
    for lap in range(branch_lap+1,57):
        index=lap-branch_lap-1
        changed=pit_lap is not None and lap>pit_lap
        is_pit=pit_lap is not None and lap==pit_lap+1
        pace=base+(assumptions.freshPaceDelta+assumptions.freshDegradation*(lap-pit_lap-1)+assumptions.trafficPenalty if changed else assumptions.currentDegradation*index)
        seconds=pace+assumptions.weatherPenalty+(assumptions.pitLoss if is_pit else 0)
        total+=seconds
        rows.append(ProjectionLap(lap=lap,seconds=seconds,cumulative=total,pit=is_pit))
    return Plan(id=identity,label=label,pitLap=pit_lap,compound=assumptions.compound if pit_lap is not None else "Unknown existing tyres",remainingSeconds=total,finishTime=branch_time+total,laps=rows)

def compare_strategy(request:StrategyRequest):
    driver=next((d for d in historical_replay().drivers if d.id==request.driverId),None)
    if driver is None:raise KeyError(request.driverId)
    n=request.completedLaps
    if n>=driver.laps:raise ValueError("Branch requires remaining recorded timing coverage")
    known_pits={pit.lap for pit in driver.pits if pit.lap<=n}
    clean=[lap for lap in driver.timing[:n] if lap.lap>1 and lap.lap not in known_pits and lap.lap-1 not in known_pits]
    if len(clean)<3:raise ValueError("At least three completed non-pit laps required after the opening lap")
    recent=clean[-3:];base=median(lap.seconds for lap in recent);anchor=driver.timing[n-1].endTime
    a=request.assumptions
    plans=[project_plan(base,n,anchor,None,a,"stay","Stay out"),project_plan(base,n,anchor,n,a,"now","Pit at branch")]
    if request.delayedPitLap is not None:plans.append(project_plan(base,n,anchor,request.delayedPitLap,a,"later",f"Pit after lap {request.delayedPitLap}"))
    stay=plans[0].remainingSeconds
    for plan in plans:plan.deltaToStay=plan.remainingSeconds-stay
    return StrategyResult(driverId=driver.id,driverName=driver.name,branchLap=n,branchTime=anchor,baselineSeconds=base,baselineLaps=[lap.lap for lap in recent],assumptions=a,plans=plans,fastestPlan=min(plans,key=lambda p:p.remainingSeconds).id)

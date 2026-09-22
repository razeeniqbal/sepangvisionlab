"""Seeded paired hypothetical scenarios; uncertainties are user assumptions."""
from typing import Literal
import numpy as np
from pydantic import Field
from .models import Model
from .strategy import StrategyRequest, StrategyResult, compare_strategy

class Uncertainty(Model):
    paceSd:float=Field(default=.5,ge=0,le=10)
    degradationSd:float=Field(default=.02,ge=0,le=.5)
    pitSd:float=Field(default=2,ge=0,le=30)
    trafficSd:float=Field(default=.2,ge=0,le=5)
class MonteCarloRequest(Model):
    strategy:StrategyRequest
    runs:int=Field(default=5000,ge=1000,le=10000,strict=True)
    seed:int=Field(default=42,ge=0,le=4294967295,strict=True)
    uncertainty:Uncertainty=Field(default_factory=Uncertainty)
class Distribution(Model):
    mean:float
    sd:float=Field(ge=0)
    p10:float
    p50:float
    p90:float
class Bin(Model):
    lower:float
    upper:float
    count:int=Field(ge=0)
class MonteCarloPlan(Model):
    id:Literal["stay","now","later"]
    label:str
    remaining:Distribution
    delta:Distribution
    fastestShare:float=Field(ge=0,le=1)
    beatsStay:float=Field(ge=0,le=1)
    histogram:list[Bin]
class MonteCarloResult(Model):
    schemaVersion:Literal[1]=1
    source:Literal["assumption-based-monte-carlo"]="assumption-based-monte-carlo"
    strategy:StrategyResult
    runs:int
    seed:int
    uncertainty:Uncertainty
    plans:list[MonteCarloPlan]

def summarize(values):
    q=np.quantile(values,[.1,.5,.9])
    return Distribution(mean=float(np.mean(values)),sd=float(np.std(values)),p10=float(q[0]),p50=float(q[1]),p90=float(q[2]))

def simulate(request:MonteCarloRequest):
    strategy=compare_strategy(request.strategy)
    a=request.strategy.assumptions;u=request.uncertainty
    rng=np.random.default_rng(request.seed);n=request.runs;m=56-strategy.branchLap
    # Common random draws pair every plan against the same hypothetical race.
    pace=rng.normal(0,u.paceSd,(n,m))
    old=np.maximum(0,rng.normal(a.currentDegradation,u.degradationSd,n))
    fresh=np.maximum(0,rng.normal(a.freshDegradation,u.degradationSd,n))
    pit=np.maximum(0,rng.normal(a.pitLoss,u.pitSd,n))
    traffic=np.maximum(0,rng.normal(a.trafficPenalty,u.trafficSd,(n,m)))
    totals=[]
    for plan in strategy.plans:
        elapsed=np.zeros(n)
        for index,lap in enumerate(range(strategy.branchLap+1,57)):
            changed=plan.pitLap is not None and lap>plan.pitLap
            if changed:
                mean=strategy.baselineSeconds+a.freshPaceDelta+fresh*(lap-plan.pitLap-1)+traffic[:,index]
            else:mean=strategy.baselineSeconds+old*index
            elapsed+=np.maximum(1,mean+pace[:,index]+a.weatherPenalty)
            if plan.pitLap is not None and lap==plan.pitLap+1:elapsed+=pit
        totals.append(elapsed)
    matrix=np.array(totals)
    deltas=matrix-matrix[0]
    winners=np.isclose(matrix,np.min(matrix,axis=0),rtol=0,atol=1e-8)
    shares=np.mean(winners/np.sum(winners,axis=0),axis=1)
    low=float(deltas.min());high=float(deltas.max())
    if high-low<1e-8:low-=1;high+=1
    edges=np.linspace(low,high,21)
    plans=[]
    for i,plan in enumerate(strategy.plans):
        counts,_=np.histogram(deltas[i],bins=edges)
        plans.append(MonteCarloPlan(id=plan.id,label=plan.label,remaining=summarize(matrix[i]),delta=summarize(deltas[i]),fastestShare=float(shares[i]),beatsStay=float(np.mean(deltas[i]<-1e-8)),histogram=[Bin(lower=float(edges[j]),upper=float(edges[j+1]),count=int(counts[j])) for j in range(20)]))
    return MonteCarloResult(strategy=strategy,runs=n,seed=request.seed,uncertainty=u,plans=plans)

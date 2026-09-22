"""Synthetic adapter. External data must normalize to these models in a later milestone."""
import json
import math
from functools import lru_cache
from pathlib import Path
from .models import Entry, CarState, RaceState, Replay

ENTRIES = tuple(Entry.model_validate(entry) for entry in json.loads((Path(__file__).parent / "data/synthetic.json").read_text()))

def state_at(time: float) -> RaceState:
    if not math.isfinite(time) or not 0 <= time <= 600:
        raise ValueError("Time must be within 0 to 600 session seconds")
    cars = []
    for entry in ENTRIES:
        total = entry.initialProgress + time / (entry.lapSeconds * 5)
        laps = math.floor(total + 1e-12)
        cars.append(CarState(id=entry.id, number=entry.number, position=1,
            progress=max(0, total-laps), completedLaps=laps,
            speedKph=5543/(entry.lapSeconds*5)*3.6, compound=entry.compound,
            tyreAge=entry.initialTyreAge+laps, throttle=50, brake=0))
    ordered = sorted(cars, key=lambda car: (-(car.completedLaps+car.progress), car.number))
    for rank, car in enumerate(ordered, 1):
        car.position = rank
    return RaceState(time=time, cars=cars)

@lru_cache(maxsize=1)
def replay() -> Replay:
    return Replay(entries=list(ENTRIES), frames=[state_at(time) for time in range(601)])

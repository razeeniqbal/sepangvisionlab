from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

class Entry(Model):
    id: str
    number: str
    color: str
    initialProgress: float = Field(ge=0, lt=1)
    lapSeconds: float = Field(gt=0, description="Legacy nominal wall seconds at 5x; multiply by 5 for session seconds")
    compound: Literal["SOFT", "MEDIUM", "HARD"]
    initialTyreAge: int = Field(ge=0)

class CarState(Model):
    id: str
    number: str
    position: int = Field(ge=1)
    progress: float = Field(ge=0, lt=1)
    completedLaps: int = Field(ge=0)
    speedKph: float = Field(ge=0)
    compound: Literal["SOFT", "MEDIUM", "HARD"]
    tyreAge: int = Field(ge=0)
    throttle: float = Field(ge=0, le=100)
    brake: float = Field(ge=0, le=100)

class RaceState(Model):
    schemaVersion: Literal[1] = 1
    sessionId: Literal["sepang-synthetic-v1"] = "sepang-synthetic-v1"
    source: Literal["synthetic"] = "synthetic"
    time: float = Field(ge=0, le=600, description="Session seconds")
    cars: list[CarState]

class Replay(Model):
    schemaVersion: Literal[1] = 1
    sessionId: Literal["sepang-synthetic-v1"] = "sepang-synthetic-v1"
    source: Literal["synthetic"] = "synthetic"
    circuitId: Literal["sepang"] = "sepang"
    duration: Literal[600] = 600
    sampleInterval: Literal[1] = 1
    interpolation: Literal["linear-distance"] = "linear-distance"
    entries: list[Entry]
    frames: list[RaceState]

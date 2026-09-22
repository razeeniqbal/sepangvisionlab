"""Features use only laps completed before the target lap starts."""
from .historical import historical_replay
FEATURES=["previousLap1","previousLap2","previousLap3","upcomingLap","lastRecordedPosition"]
TRAIN_END=2700.0
VALIDATION_END=3900.0

def features_at(driver, completed):
    if completed<3 or completed>len(driver.timing):
        raise ValueError("Three completed laps required")
    history=driver.timing[:completed]
    return [history[-1].seconds,history[-2].seconds,history[-3].seconds,completed+1,history[-1].position]

def build_rows():
    rows=[]
    for driver in historical_replay().drivers:
        for completed in range(3,len(driver.timing)):
            target=driver.timing[completed]
            issued=driver.timing[completed-1].endTime
            split="excluded-boundary"
            if target.endTime<=TRAIN_END:split="train"
            elif issued>=TRAIN_END and target.endTime<=VALIDATION_END:split="validation"
            elif issued>=VALIDATION_END:split="test"
            rows.append(dict(driverId=driver.id,lap=completed+1,issuedAt=issued,targetEnd=target.endTime,target=target.seconds,split=split,**dict(zip(FEATURES,features_at(driver,completed)))))
    return rows

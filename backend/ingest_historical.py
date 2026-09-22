"""Explicit one-time import; replay never accesses the external service."""
import hashlib
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).parent / "data/malaysia-2017"
BASE = "https://api.jolpi.ca/ergast/f1/2017/15/"

def fetch_pages(kind):
    pages=[]; offset=0
    while True:
        url=f"{BASE}{kind}/?limit=100&offset={offset}"
        cache=ROOT/f"{kind}-{offset}.json"
        if cache.exists(): payload=cache.read_bytes()
        else:
            request=urllib.request.Request(url,headers={"User-Agent":"SepangVisionLab/0.1.0"})
            with urllib.request.urlopen(request,timeout=30) as response: payload=response.read()
            cache.write_bytes(payload)
            time.sleep(1)
        data=json.loads(payload)["MRData"]
        pages.append(data["RaceTable"]["Races"][0])
        offset+=int(data["limit"])
        if offset>=int(data["total"]):break
    return pages

def seconds(text):
    parts=text.split(":")
    return sum(float(value)*60**index for index,value in enumerate(reversed(parts)))

def main():
    ROOT.mkdir(parents=True,exist_ok=True)
    results=fetch_pages("results")[0]
    assert results["Circuit"]["circuitId"]=="sepang" and results["date"]=="2017-10-01"
    entries=[]
    for result in results["Results"]:
        driver=result["Driver"]
        entries.append(dict(id=driver["driverId"],number=result["number"],name=driver["givenName"]+" "+driver["familyName"],team=result["Constructor"]["name"],teamId=result["Constructor"]["constructorId"],grid=int(result["grid"]),classification=int(result["position"]),laps=int(result["laps"]),status=result["status"]))
    rows=[]
    for page in fetch_pages("laps"):
        for lap in page["Laps"]:
            for timing in lap["Timings"]:
                rows.append(dict(id=timing["driverId"],lap=int(lap["number"]),position=int(timing["position"]),seconds=seconds(timing["time"])))
    assert len({(r["id"],r["lap"]) for r in rows})==len(rows)
    for entry in entries:
        laps=sorted((r for r in rows if r["id"]==entry["id"]),key=lambda r:r["lap"])
        assert [r["lap"] for r in laps]==list(range(1,entry["laps"]+1)),entry["id"]
        elapsed=0
        for lap in laps:
            elapsed+=lap["seconds"];lap["endTime"]=round(elapsed,3)
    pits=[]
    for page in fetch_pages("pitstops"):
        for pit in page["PitStops"]:
            pits.append(dict(id=pit["driverId"],lap=int(pit["lap"]),stop=int(pit["stop"]),duration=seconds(pit["duration"])))
    for name,data in [("entries",entries),("laps",rows),("pits",pits)]:pq.write_table(pa.Table.from_pylist(data),ROOT/f"{name}.parquet")
    winner=results["Results"][0]
    winner_total=max(r["endTime"] for r in rows if r["id"]==winner["Driver"]["driverId"])
    assert abs(winner_total-int(winner["Time"]["millis"])/1000)<.01
    provenance={"provider":"Jolpica F1 (Ergast-compatible)","race":"2017 Malaysian Grand Prix","retrievedAt":datetime.now(timezone.utc).isoformat(),"urls":[BASE+kind+"/" for kind in ["results","laps","pitstops"]],"rawHashes":{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in ROOT.glob("*.json") if f.name!="provenance.json"},"lapRecords":len(rows),"pitRecords":len(pits),"winnerElapsedSeconds":winner_total}
    (ROOT/"provenance.json").write_text(json.dumps(provenance,indent=2))
    print(json.dumps({"entries":len(entries),"laps":len(rows),"pits":len(pits),"winnerSeconds":winner_total}))

if __name__=="__main__":main()

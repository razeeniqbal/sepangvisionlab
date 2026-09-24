"""Offline gesture experiment. Never trains on HTTP requests or activates app controls."""
import argparse
import hashlib
import json
import platform
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
import sklearn
import xgboost
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from xgboost import XGBClassifier

LABELS = ['neutral', 'point', 'pinch', 'grab', 'rotate', 'zoom', 'swipe_left', 'swipe_right']
FEATURE_VERSION = 'mirrored-wrist-palm-normalized-20-frame-v1'

def number(value):
    return type(value) in (int, float) and np.isfinite(value)

def validate_clip(c):
    if not isinstance(c, dict) or c.get('label') not in LABELS:
        raise ValueError('Unknown gesture label.')
    for key in ('id', 'sessionId'):
        if not isinstance(c.get(key), str) or not 1 <= len(c[key]) <= 100:
            raise ValueError('Missing clip/session identity.')
    if not number(c.get('aspect')) or not .25 <= c['aspect'] <= 4:
        raise ValueError('Invalid camera aspect ratio.')
    frames = c.get('frames')
    if not isinstance(frames, list) or not 12 <= len(frames) <= 40:
        raise ValueError('Clip needs 12–40 frames.')
    expected = 2 if c['label'] in ('rotate', 'zoom') else 1
    previous = None
    identities = None
    for f in frames:
        if not isinstance(f, dict) or not number(f.get('ms')) or not 0 <= f['ms'] <= 2200:
            raise ValueError('Invalid frame timestamp.')
        if previous is not None and not 0 < f['ms']-previous <= 350:
            raise ValueError('Nonmonotonic or interrupted recording.')
        previous = f['ms']
        hands = f.get('hands')
        if not isinstance(hands, list) or len(hands) != expected:
            raise ValueError('Wrong hand count for label.')
        names = []
        for h in hands:
            if not isinstance(h, dict) or h.get('label') not in ('Left', 'Right') or not number(h.get('score')) or not .8 <= h['score'] <= 1:
                raise ValueError('Invalid hand identity/confidence.')
            names.append(h['label'])
            pts = h.get('points')
            if not isinstance(pts, list) or len(pts) != 21 or any(not isinstance(p, dict) or any(not number(p.get(k)) or abs(p[k]) > 10 for k in ('x', 'y', 'z')) for p in pts):
                raise ValueError('Invalid landmarks.')
        names = sorted(names)
        if len(set(names)) != expected or (identities is not None and names != identities):
            raise ValueError('Unstable hand identity.')
        identities = names
    if frames[-1]['ms']-frames[0]['ms'] < 1500:
        raise ValueError('Clip is too short.')
    return c

def features(c):
    validate_clip(c)
    rows = []
    for f in c['frames']:
        row = []
        for name in ('Left', 'Right'):
            h = next((h for h in f['hands'] if h['label'] == name), None)
            if h is None:
                row.extend([0.] * 68)
                continue
            p = np.array([[(1-v['x'])*c['aspect'], v['y'], v['z']*c['aspect']] for v in h['points']])
            scale = float(np.linalg.norm(p[5, :2]-p[17, :2]))
            if scale < .025:
                raise ValueError('Hand is too small for stable normalization.')
            row.extend([1., *p[0], scale, *((p-p[0])/scale).ravel()])
        rows.append(row)
    times = np.array([f['ms'] for f in c['frames']])
    rows = np.array(rows)
    grid = np.linspace(times[0], times[-1], 20)
    return np.array([np.interp(grid, times, rows[:, i]) for i in range(rows.shape[1])]).T.ravel()

def load_datasets(paths):
    clips, fingerprints, provenance = {}, {}, []
    for path in paths:
        path = Path(path)
        if path.stat().st_size > 50_000_000:
            raise ValueError('Dataset exceeds 50 MB.')
        raw = path.read_bytes()
        d = json.loads(raw)
        if not isinstance(d, dict) or d.get('schemaVersion') != 1 or d.get('kind') != 'sepang-gesture-landmarks' or d.get('source') != 'user-labeled-camera' or d.get('coordinateSystem') != 'unmirrored-camera-normalized':
            raise ValueError('Unsupported dataset schema or provenance.')
        if not isinstance(d.get('clips'), list) or not 1 <= len(d['clips']) <= 240:
            raise ValueError('Dataset must contain 1–240 clips.')
        provenance.append({'file':path.name, 'sha256':hashlib.sha256(raw).hexdigest()})
        for c in d['clips']:
            validate_clip(c)
            if c['id'] in clips:
                if c != clips[c['id']]:
                    raise ValueError('Conflicting duplicate clip ID.')
                continue  # Re-exporting the same in-memory clips is harmless.
            fingerprint = hashlib.sha256(json.dumps(c['frames'], sort_keys=True).encode()).hexdigest()
            if fingerprint in fingerprints:
                raise ValueError('Duplicated recording under a different clip ID.')
            fingerprints[fingerprint] = c['id']
            clips[c['id']] = c
            if len(clips) > 5000:
                raise ValueError('Experiment limit is 5000 clips.')
    if not clips:
        raise ValueError('No labeled recordings supplied.')
    return list(clips.values()), provenance

def split_sessions(clips):
    sessions = sorted({c['sessionId'] for c in clips})
    if len(sessions) < 5:
        raise ValueError('Need at least five independent recording sessions, each covering every label.')
    np.random.default_rng(42).shuffle(sessions)
    holdout = max(1, len(sessions)//5)
    groups = {'test':sessions[:holdout], 'validation':sessions[holdout:2*holdout], 'train':sessions[2*holdout:]}
    split = {name:[i for i,c in enumerate(clips) if c['sessionId'] in group] for name,group in groups.items()}
    for name, indices in split.items():
        counts = {label:sum(clips[i]['label']==label for i in indices) for label in LABELS}
        if any(n < 2 for n in counts.values()):
            raise ValueError(f'{name} needs at least two clips of every label. Collect complete sessions; do not change IDs to manipulate the split.')
    return split, groups

def score(y, prediction):
    p,r,f,s = precision_recall_fscore_support(y,prediction,labels=list(range(8)),zero_division=0)
    return {'accuracy':float(accuracy_score(y,prediction)), 'macroPrecision':float(p.mean()), 'macroRecall':float(r.mean()), 'macroF1':float(f.mean()),
            'perClass':{label:{'precision':float(p[i]),'recall':float(r[i]),'f1':float(f[i]),'support':int(s[i])} for i,label in enumerate(LABELS)},
            'confusionMatrix':confusion_matrix(y,prediction,labels=list(range(8))).tolist()}

def compare(x, y, split):
    models = {'Random Forest':RandomForestClassifier(n_estimators=120,max_depth=12,class_weight='balanced',random_state=42,n_jobs=1),
              'SVM':make_pipeline(StandardScaler(),SVC(C=1,class_weight='balanced')),
              'XGBoost':XGBClassifier(n_estimators=100,max_depth=3,learning_rate=.05,objective='multi:softprob',num_class=8,random_state=42,n_jobs=1),
              'MLP':make_pipeline(StandardScaler(),MLPClassifier(hidden_layer_sizes=(64,),max_iter=400,random_state=42))}
    results = []
    for name, model in models.items():
        with warnings.catch_warnings(record=True) as notices:
            warnings.simplefilter('always')
            model.fit(x[split['train']], y[split['train']])
        validation = score(y[split['validation']], model.predict(x[split['validation']]))
        sample=x[split['validation'][:1]]
        model.predict(sample)
        durations=[]
        for _ in range(30):
            start=time.perf_counter();model.predict(sample);durations.append((time.perf_counter()-start)*1000)
        results.append({'name':name,'validation':validation,'singleClipLatencyMs':{'median':float(np.median(durations)),'p95':float(np.percentile(durations,95))},'warnings':sorted({str(w.message) for w in notices})})
    selected=max(results,key=lambda r:r['validation']['macroF1'])['name']
    test=score(y[split['test']],models[selected].predict(x[split['test']]))
    return selected, models[selected], results, test

def train(paths, output):
    clips, sources=load_datasets(paths)
    split, groups=split_sessions(clips)
    x=np.array([features(c) for c in clips]);y=np.array([LABELS.index(c['label']) for c in clips])
    selected, model, results, test=compare(x,y,split)
    report={'schemaVersion':1,'featureVersion':FEATURE_VERSION,'labels':LABELS,'seed':42,'sources':sources,'sessions':groups,
            'counts':{name:{label:sum(clips[i]['label']==label for i in ids) for label in LABELS} for name,ids in split.items()},
            'selectionRule':'Highest validation macro F1; test used once for selected model only. Ties follow listed model order.',
            'selectedModel':selected,'models':results,'selectedModelTest':test,'versions':{'python':platform.python_version(),'sklearn':sklearn.__version__,'xgboost':xgboost.__version__},
            'limitations':'Offline clip classification only. Session holdout is not participant holdout. No cross-person or live reliability claim. Timing excludes MediaPipe and feature extraction. Convergence warnings must be reviewed. No model is automatically installed in the app.'}
    output=Path(output)
    output.mkdir(parents=True,exist_ok=False)
    joblib.dump({'model':model,'labels':LABELS,'featureVersion':FEATURE_VERSION},output/'model.joblib',compress=3)
    (output/'report.json').write_text(json.dumps(report,indent=2,allow_nan=False),encoding='utf-8')
    print(json.dumps({'selectedModel':selected,'test':test,'output':str(output)},indent=2))
    return report

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('datasets',nargs='+',type=Path)
    parser.add_argument('--output',required=True,type=Path,help='New directory for the experiment; existing directories are never overwritten.')
    args=parser.parse_args()
    try: train(args.datasets,args.output)
    except (ValueError,OSError,json.JSONDecodeError) as e: parser.exit(2,f'Gesture training stopped: {e}\n')

if __name__=='__main__': main()

"""Synthetic fixtures verify plumbing, never gesture accuracy."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
from .gesture_training import LABELS, features, validate_clip, load_datasets, split_sessions, compare

def clip(label='neutral',session='s0',ident='c0'):
    hands=[{'label':'Left','score':.95,'points':[{'x':.2+i*.01,'y':.3+i*.01,'z':i*.001} for i in range(21)]}]
    if label in ('rotate','zoom'):
        h=copy.deepcopy(hands[0]);h['label']='Right'
        for p in h['points']:p['x']+=.3
        hands.append(h)
    return {'id':ident,'sessionId':session,'label':label,'aspect':4/3,'frames':[{'ms':i*100,'hands':copy.deepcopy(hands)} for i in range(20)]}

class GestureTrainingTest(unittest.TestCase):
    def test_features_keep_motion_and_normalize_shape(self):
        c=clip();a=features(c).reshape(20,136)
        self.assertEqual(a.shape,(20,136));self.assertTrue(np.isfinite(a).all())
        for f in c['frames']:
            for p in f['hands'][0]['points']:p['x']+=.1
        b=features(c).reshape(20,136)
        np.testing.assert_allclose(a[:,5:68],b[:,5:68],atol=1e-12)
        self.assertFalse(np.allclose(a[:,1],b[:,1]))
        c=clip()
        for i,f in enumerate(c['frames']):
            for p in f['hands'][0]['points']:p['x']+=i*.01
        x=features(c).reshape(20,136)
        self.assertLess(x[-1,1],x[0,1]) # Mirrored right/left semantics retained.

    def test_rejects_broken_clips(self):
        for mutate in [lambda c:c['frames'][5].update(ms=0),lambda c:c.update(label='unknown'),lambda c:c['frames'][2]['hands'][0].update(score=.2),lambda c:c['frames'][2]['hands'][0]['points'][0].update(x=float('nan')),lambda c:c['frames'][2]['hands'][0].update(label='Right')]:
            c=clip();mutate(c)
            with self.assertRaises(ValueError):validate_clip(c)
        c=clip('zoom');self.assertIsNotNone(validate_clip(c))
        for f in c['frames']: f['hands']=f['hands'][:1]
        with self.assertRaises(ValueError):validate_clip(c)

    def test_group_split_disjoint_and_complete(self):
        clips=[clip(label,f's{s}',f'{s}-{label}-{n}') for s in range(5) for label in LABELS for n in range(2)]
        split,groups=split_sessions(clips)
        self.assertEqual(len(split['train']),48)
        self.assertFalse(set(groups['train'])&set(groups['test']))
        self.assertFalse(set(groups['validation'])&set(groups['test']))
        self.assertEqual(split_sessions(clips),(split,groups))
        with self.assertRaises(ValueError):split_sessions([c for c in clips if c['label']!='grab'])
        with self.assertRaises(ValueError):split_sessions(clips[:16])

    def test_loader_deduplicates_reexports_and_rejects_relabeling(self):
        d={'schemaVersion':1,'kind':'sepang-gesture-landmarks','source':'user-labeled-camera','coordinateSystem':'unmirrored-camera-normalized','clips':[clip()]}
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'fixture.json';p.write_text(json.dumps(d))
            clips,sources=load_datasets([p,p]);self.assertEqual(len(clips),1);self.assertEqual(len(sources),2)
            d['clips'].append(copy.deepcopy(d['clips'][0]));d['clips'][1]['id']='different';p.write_text(json.dumps(d))
            with self.assertRaises(ValueError):load_datasets([p])

    def test_four_model_comparison_with_synthetic_fixture_only(self):
        # Tiny separable numeric vectors exercise APIs, not real recognition.
        y=np.tile(np.arange(8),6);x=np.eye(8)[y]
        split={'train':list(range(32)),'validation':list(range(32,40)),'test':list(range(40,48))}
        selected,model,results,test=compare(x,y,split)
        self.assertEqual(len(results),4);self.assertIn(selected,[r['name'] for r in results])
        self.assertEqual(len(test['confusionMatrix']),8)
        self.assertEqual(sum(test['perClass'][label]['support'] for label in LABELS),8)
        self.assertTrue(all(r['singleClipLatencyMs']['median']>=0 for r in results))
        self.assertEqual(len(model.predict(x[:1])),1)

if __name__=='__main__':unittest.main()

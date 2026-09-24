import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from .main import app
from .race_engineer import EngineerRequest, run_engineer
from .strategy import StrategyRequest

class RaceEngineerTest(unittest.TestCase):
    def request(self,mode='local'):
        return EngineerRequest(strategy=StrategyRequest(driverId='max_verstappen',completedLaps=30,delayedPitLap=33),mode=mode,consent=mode=='ai')
    def test_local_explains_real_simulation_without_network(self):
        with patch('backend.race_engineer.response',side_effect=AssertionError('No network')):
            r=run_engineer(self.request())
        self.assertEqual(r.source,'local-simulator-explanation')
        self.assertEqual(r.strategy.branchLap,30)
        self.assertEqual(r.focus,['stay','now','later'])
        self.assertIn('22.000 s slower',r.explanation[3])
        self.assertEqual(r.strategy.baselineLaps,[26,29,30])
    def test_ai_requires_configuration_and_consent(self):
        with patch.dict('os.environ',{},clear=True):
            with self.assertRaises(PermissionError):run_engineer(self.request('ai'))
        req=self.request('ai');req.consent=False
        with patch('backend.race_engineer.configured',return_value=True):
            with self.assertRaises(PermissionError):run_engineer(req)
    def test_ai_executes_only_allowed_tool_and_renders_exact_evidence(self):
        first={'output':[{'type':'function_call','name':'compare_captured_strategy','arguments':'{}','call_id':'call-1'}]}
        final={'output':[{'type':'message','content':[{'type':'output_text','text':'{"planIds":["now"]}'}]}]}
        with patch('backend.race_engineer.configured',return_value=True),patch('backend.race_engineer.response',side_effect=[first,final]) as api:
            r=run_engineer(self.request('ai'))
        self.assertEqual(r.focus,['now']);self.assertEqual(r.source,'ai-selected-simulator-evidence')
        self.assertIn('22.000 s slower',r.explanation[2])
        self.assertEqual(api.call_count,2)
        self.assertEqual(api.call_args_list[1].args[1]['input'][-1]['type'],'function_call_output')
    def test_injected_tool_arguments_cannot_change_branch(self):
        bad={'output':[{'type':'function_call','name':'compare_captured_strategy','arguments':'{"completedLaps":55}','call_id':'x'}]}
        with patch('backend.race_engineer.configured',return_value=True),patch('backend.race_engineer.response',return_value=bad),patch('backend.race_engineer.compare_strategy') as simulator:
            with self.assertRaises(ValueError):run_engineer(self.request('ai'))
            simulator.assert_not_called()
    def test_unknown_evidence_rejected(self):
        first={'output':[{'type':'function_call','name':'compare_captured_strategy','arguments':'{}','call_id':'x'}]}
        final={'output':[{'type':'message','content':[{'type':'output_text','text':'{"planIds":["invented"]}'}]}]}
        with patch('backend.race_engineer.configured',return_value=True),patch('backend.race_engineer.response',side_effect=[first,final]):
            with self.assertRaises(ValueError):run_engineer(self.request('ai'))
    def test_api_validation_and_status(self):
        client=TestClient(app)
        with patch('backend.race_engineer.configured',return_value=False):
            self.assertEqual(client.post('/api/v1/engineer/explain',json=self.request('ai').model_dump()).status_code,503)
        req=self.request().model_dump();req['strategy']['completedLaps']=0
        self.assertEqual(client.post('/api/v1/engineer/explain',json=req).status_code,422)
        self.assertEqual(client.post('/api/v1/engineer/explain',json=self.request().model_dump()).status_code,200)

if __name__=='__main__':unittest.main()

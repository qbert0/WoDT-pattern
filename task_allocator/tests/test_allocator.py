import copy
import re
import sys
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
WARETWIN = ROOT.parent / 'WareTwin' / 'backend'
sys.path.insert(0, str(ROOT))
from task_allocator.conditions import evaluate, UNKNOWN
from task_allocator.graph import Contract, owner
from task_allocator.service import decisions


def contract():
    source = (ROOT / 'cypher/waretwin_allocation.cypher').read_text()
    fields = [re.search(r'task\.' + key + r" = '([^']+)'", source)[1]
              for key in ('activationCondition', 'precondition', 'postcondition')]
    return Contract('G_WT_TRANSPORT', 'A_ROBOT', (), 'waretwin:robot-*', *fields)


class Conditions(unittest.TestCase):
    def test_unknown_and_safe_interpreter(self):
        self.assertIs(evaluate('Robot.battery > 20', {'Robot': {}}), UNKNOWN)
        self.assertIs(evaluate('Robot.task == null', {'Robot': {}}), UNKNOWN)
        self.assertIs(evaluate('Robot.task == null', {'Robot': {'task': None}}), True)
        self.assertIs(evaluate('__import__("os").system("false")', {}), UNKNOWN)
        self.assertIs(evaluate('true OR malicious()', {}), UNKNOWN)
        self.assertIs(evaluate('Robot.status NOT IN ["ERROR"] AND Robot.battery > 20',
                               {'Robot': {'status': 'IDLE', 'battery': 21}}), True)

    def test_nearest_owner_and_ambiguity(self):
        rows = [{'id': 'A_ROBOT', 'depth': 0}, {'id': 'A_WARETWIN', 'depth': 2}]
        session = SimpleNamespace(run=lambda *a, **k: rows)
        self.assertEqual(owner(session, 'goal')['id'], 'A_ROBOT')
        rows.append({'id': 'other', 'depth': 0})
        with self.assertRaises(ValueError): owner(session, 'goal')


@unittest.skipUnless(WARETWIN.exists(), 'Sibling WareTwin needed for simulator parity tests')
class Integration(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, str(WARETWIN))
        from app.sim.engine import SimEngine
        from app.sim.navgrid import load_layout
        from app.allocation import dispatch_snapshot
        self.layout = load_layout()
        self.engine = SimEngine(self.layout)
        self.engine.state['tasks'].clear()
        self.server = SimpleNamespace(engine=self.engine, run_id='test-run', assignment_mode='external',
                                      paused=False, speed=1, mqtt=SimpleNamespace(namespace='waretwin'),
                                      assignment_results={}, dispatch_ticks={})
        self.snapshot_fn = dispatch_snapshot
        self.task = self.engine.create_task('PICK', 'HIGH', 'SHELF-A12', 'PACK-01')

    def snapshot(self):
        snap = self.snapshot_fn(self.server)
        self.server.dispatch_ticks[snap['tick']] = snap['published_at']
        return snap

    def test_parity_and_end_to_end_commit(self):
        from app.allocation import Assignment, apply_assignment
        baseline = self.engine.clone()
        baseline._assign_tasks()
        d = next(decisions(self.snapshot(), self.layout, contract()))
        internal = baseline.state['recent_decisions'][0]
        self.assertEqual(d['robot_id'], internal['selected_robot'])
        self.assertEqual(d['candidates'], internal['candidates'])
        body = Assignment(**d)
        result = apply_assignment(self.server, body)
        self.assertIs(evaluate(contract().postcondition, result['context']), True)
        before = self.engine.decision_seq
        self.assertEqual(result, apply_assignment(self.server, body))
        self.assertEqual(before, self.engine.decision_seq)
        self.engine.external_allocation = True
        for _ in range(6000):
            self.engine.step()
            if self.task['status'] == 'COMPLETED': break
        self.assertEqual(self.task['status'], 'COMPLETED')

    def test_crossfloor_score_parity(self):
        from app.sim.engine import SIM
        from task_allocator.scoring import rank
        for lift_fault in (False, True):
            for r in self.engine.state['robots'].values():
                r['fsm'] = 'IDLE'; r['status'] = 'IDLE'; r['battery'] = 70
                r['floor'] = 2; r['stats']['tasks_completed'] = 9
            for lift in self.engine.state['lifts'].values():
                lift['fault'] = lift_fault
                lift['reserved_by'] = 'R01'
                lift['queue']['1'] = ['R01', 'R02']
            baseline = self.engine.clone(); baseline._assign_tasks()
            candidates, lifts = rank(self.engine.state, self.layout, self.task,
                                     list(self.engine.state['robots'].values()), SIM)
            self.assertEqual(candidates[:5], baseline.state['recent_decisions'][0]['candidates'])
            rid = candidates[0]['robot_id']
            self.assertEqual(lifts.get(rid), baseline.rt[rid].planned_lift_id)

    def test_filters_conflicts_and_reset(self):
        from fastapi import HTTPException
        from app.allocation import Assignment, apply_assignment
        snap = self.snapshot()
        d = next(decisions(snap, self.layout, contract()))
        body = Assignment(**d)
        self.engine.state['robots'][d['robot_id']]['fsm'] = 'CHARGING'
        with self.assertRaises(HTTPException) as caught: apply_assignment(self.server, body)
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(self.task['status'], 'WAITING')
        self.server.run_id = 'new-run'
        with self.assertRaises(HTTPException): apply_assignment(self.server, body)
        with self.assertRaises(ValueError): list(decisions(snap, self.layout, contract(), now=time.time()+10))
        snap['state']['tasks'][self.task['id']]['load_units'] = 100000
        self.assertEqual(list(decisions(snap, self.layout, contract())), [])

    def test_unique_robots_per_round(self):
        self.engine.create_task('PICK', 'HIGH', 'SHELF-A12', 'PACK-01')
        batch = list(decisions(self.snapshot(), self.layout, contract()))
        self.assertEqual(len(batch), 2)
        self.assertEqual(len({d['robot_id'] for d in batch}), 2)


if __name__ == '__main__': unittest.main()

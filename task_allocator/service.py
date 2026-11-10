"""One allocation round. Inputs originate in an atomic Ditto dispatch snapshot."""
import time
import uuid
from .conditions import evaluate
from .scoring import rank, WEIGHTS

PRIORITIES = {"CRITICAL": 0, "HIGH": 1, "NORMAL": 2, "LOW": 3}


def decisions(snapshot, layout, contract, *, now=None, max_age=5):
    now = time.time() if now is None else now
    age = now - snapshot['published_at']
    if not 0 <= age <= max_age: raise ValueError('Stale dispatch snapshot or clock skew')
    if snapshot['mode'] != 'external' or snapshot['paused']: return
    if snapshot['layout_id'] != layout['id']: raise ValueError('Layout mismatch')
    state = snapshot['state']
    locations = {l['id'] for l in layout['locations']}
    waiting = sorted(state['tasks'].values(), key=lambda t: (PRIORITIES[t['priority']], t['created_tick']))
    available = [state['robots'][rid] for rid in snapshot['robot_order']]
    for task in waiting:
        if evaluate(contract.activation, {'Task': task}) is not True: continue
        if task['source'] not in locations or task['destination'] not in locations: continue
        eligible = [r for r in available
                    if contract.admits(f"{snapshot['namespace']}:robot-{r['id']}")
                    and evaluate(contract.precondition, {'Task': task, 'Robot': r}) is True]
        candidates, lifts = rank(state, layout, task, eligible, snapshot['constants'])
        if not candidates: continue
        robot_id = candidates[0]['robot_id']
        yield {'decision_id': uuid.uuid4().hex, 'run_id': snapshot['run_id'],
               'observed_tick': snapshot['tick'], 'task_id': task['id'], 'robot_id': robot_id,
               'goal_id': contract.goal_id, 'model_task_id': 'T_ORDER_ASSIGN',
               'planned_lift_id': lifts.get(robot_id), 'candidates': candidates[:5],
               'weights': dict(WEIGHTS)}
        available = [r for r in available if r['id'] != robot_id]

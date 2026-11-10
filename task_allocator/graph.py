"""Read only the allocation contract and resolve inherited responsibilities."""
from dataclasses import dataclass
import fnmatch

OWNER_QUERY = '''
MATCH path=(parent:Goal)-[:REFINES*0..]->(:Goal {id:$goal_id})
MATCH (parent)-[:DELEGATED_TO]->(agent:Agent)
RETURN agent.id AS id, agent.thingIds AS things, agent.thingIdPattern AS pattern,
       length(path) AS depth ORDER BY depth, id
'''


@dataclass(frozen=True)
class Contract:
    goal_id: str
    agent_id: str
    things: tuple
    pattern: str | None
    activation: str
    precondition: str
    postcondition: str

    def admits(self, thing_id):
        # Explicit instance list takes precedence over the discovery pattern.
        return thing_id in self.things if self.things else bool(self.pattern and fnmatch.fnmatchcase(thing_id, self.pattern))


def owner(session, goal_id):
    rows = list(session.run(OWNER_QUERY, goal_id=goal_id))
    if not rows: raise ValueError(f'No delegated agent for {goal_id}')
    nearest = {r['id']: r for r in rows if r['depth'] == rows[0]['depth']}
    if len(nearest) != 1: raise ValueError(f'Ambiguous responsibility for {goal_id}')
    return next(iter(nearest.values()))


def load_contract(session):
    rows = list(session.run('''
        MATCH (:Goal {id:'G_WT_ALLOC'})-[:OPERATIONALIZED_BY]->(t:Task {id:'T_ORDER_ASSIGN'})
        RETURN properties(t) AS task
    '''))
    if len(rows) != 1: raise ValueError('Seed the optional T_ORDER_ASSIGN contract first')
    task = rows[0]['task']
    coordinator = owner(session, 'G_WT_ALLOC')
    if coordinator['id'] != 'A_WARETWIN': raise ValueError('Unsupported allocation executor')
    executor = owner(session, task['executionGoalId'])
    if not executor['things'] and not executor['pattern']: raise ValueError('Agent has no Thing mapping')
    for key in ('activationCondition', 'precondition', 'postcondition'):
        if not isinstance(task.get(key), str) or not task[key]: raise ValueError(f'Missing {key}')
    return Contract(task['executionGoalId'], executor['id'], tuple(executor['things'] or []),
                    executor['pattern'], task['activationCondition'], task['precondition'], task['postcondition'])

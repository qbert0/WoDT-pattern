"""Unit tests plus opt-in integration tests against an EMPTY disposable Neo4j.

NEO4J_TEST_URI / NEO4J_TEST_USER / NEO4J_TEST_PASSWORD enable integration tests.
Never point these at the application database. No data is deleted by the suite.
"""
import copy
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from migrate_goal_dependencies import canonical, conversion_plan, expected_snapshot, migrate
from migrate_goal_ids import graph_snapshot
from robot_contract import apply_contract, load_contract
from seed_neo4j import CYPHER_FILES, iter_statements

CROSS_AGENT = {
    ('G_WT_FULFILL_OPERATIONS', 'G_WT_TRANSPORT'),
    ('G_WT_FULFILL_OPERATIONS', 'G_WT_CROSSFLOOR'),
    ('G_WT_SAFETY', 'G_Z_MAINTAIN_SAFE_TRAFFIC'),
    ('G_WT_SAFETY', 'G_P_PROVIDE_SITUATIONAL_AWARENESS'),
    ('G_WT_INFRA', 'G_CV_PROVIDE_MATERIAL_FLOW'),
}


def node(key, label='Goal'):
    return {'key': key, 'labels': [label], 'props': {'id': key}}


def edge(key, a, b, kind='REFINES', **props):
    return {'key': key, 'a': a, 'b': b, 'type': kind, 'props': props}


def fixture():
    return {
        'nodes': [node(g) for g in ('root', 'parent', 'child', 'leaf')]
                 + [node(a, 'Agent') for a in ('A', 'B')],
        'edges': [edge('r1', 'root', 'parent', type='OR'),
                  edge('r2', 'parent', 'child', type='AND', description='preserve me'),
                  edge('r3', 'child', 'leaf', type='AND'),
                  edge('a1', 'root', 'A', 'DELEGATED_TO'),
                  edge('a2', 'child', 'B', 'DELEGATED_TO')],
    }


class ConversionPlanTests(unittest.TestCase):
    def test_inherited_parent_direct_child_and_same_agent_refinements(self):
        before = fixture()
        original = copy.deepcopy(before)
        changes = conversion_plan(before)
        self.assertEqual([(c['parent'], c['child']) for c in changes], [('parent', 'child')])
        self.assertEqual(changes[0]['parentAgent'], 'A')
        self.assertEqual(changes[0]['childAgent'], 'B')
        self.assertEqual(changes[0]['dependency']['props'],
                         {'type': 'ACHIEVED', 'description': 'preserve me'})
        self.assertEqual(before, original)
        self.assertEqual(conversion_plan(expected_snapshot(before, changes)), [])

    def test_same_agent_direct_delegation_is_not_a_dependency(self):
        graph = fixture()
        graph['edges'][-1]['b'] = 'A'
        self.assertEqual(conversion_plan(graph), [])

    def test_nearest_ancestor_wins(self):
        graph = fixture()
        graph['edges'].append(edge('a3', 'parent', 'B', 'DELEGATED_TO'))
        graph['edges'][0]['props']['type'] = 'AND'
        self.assertEqual([(c['parent'], c['child']) for c in conversion_plan(graph)], [('root', 'parent')])

    def test_missing_agent_is_reported(self):
        graph = fixture()
        graph['edges'] = [e for e in graph['edges'] if e['key'] != 'a1']
        with self.assertRaisesRegex(ValueError, 'Missing responsible agent'):
            conversion_plan(graph)

    def test_ambiguous_direct_or_equidistant_ancestors_are_reported(self):
        for assigned_goal in ('root', 'parent'):
            with self.subTest(assigned_goal=assigned_goal):
                graph = fixture()
                graph['nodes'].append(node('other'))
                graph['edges'].extend([edge('x1', 'other', 'B', 'DELEGATED_TO'),
                                       edge('x2', 'other', assigned_goal)])
                if assigned_goal == 'root':
                    graph['edges'].append(edge('x3', 'root', 'B', 'DELEGATED_TO'))
                with self.assertRaisesRegex(ValueError, 'Ambiguous nearest agent'):
                    conversion_plan(graph)

    def test_unassigned_cycle_terminates_with_error(self):
        graph = fixture()
        graph['edges'] = [edge('r1', 'root', 'parent'), edge('r2', 'parent', 'root')]
        with self.assertRaisesRegex(ValueError, 'Missing responsible agent'):
            conversion_plan(graph)

    def test_cross_agent_or_requires_explicit_modeling(self):
        graph = fixture()
        graph['edges'][1]['props']['type'] = 'OR'
        with self.assertRaisesRegex(ValueError, 'OR/unknown'):
            conversion_plan(graph)

    def test_existing_dependency_is_reused_other_types_are_preserved(self):
        graph = fixture()
        graph['edges'].extend([
            edge('d1', 'parent', 'child', 'DEPENDS_ON', type='ACHIEVED', clause='ready'),
            edge('d2', 'parent', 'child', 'DEPENDS_ON', type='PARAMETER'),
        ])
        changes = conversion_plan(graph)
        after = expected_snapshot(graph, changes)
        deps = [e for e in after['edges'] if e['type'] == 'DEPENDS_ON']
        self.assertEqual(len(deps), 2)
        self.assertEqual(changes[0]['dependency']['props']['clause'], 'ready')

    def test_duplicate_or_conflicting_edges_are_reported(self):
        for extra, message in [
            ([edge('r4', 'parent', 'child', type='AND')], 'Duplicate refinement'),
            ([edge('d1', 'parent', 'child', 'DEPENDS_ON', type='ACHIEVED'),
              edge('d2', 'parent', 'child', 'DEPENDS_ON', type='ACHIEVED')], 'Duplicate ACHIEVED'),
            ([edge('d1', 'parent', 'child', 'DEPENDS_ON', type='ACHIEVED', description='conflict')],
             'Conflicting dependency property'),
        ]:
            with self.subTest(message=message):
                graph = fixture()
                graph['edges'].extend(extra)
                with self.assertRaisesRegex(ValueError, message):
                    conversion_plan(graph)


@unittest.skipUnless(os.getenv('NEO4J_TEST_URI'), 'Requires disposable NEO4J_TEST_URI')
class Neo4jConversionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from neo4j import GraphDatabase
        cls.driver = GraphDatabase.driver(os.environ['NEO4J_TEST_URI'], auth=(
            os.getenv('NEO4J_TEST_USER', 'neo4j'), os.environ['NEO4J_TEST_PASSWORD']))
        cls.addClassCleanup(cls.driver.close)
        with cls.driver.session() as session:
            if session.run('MATCH (n) RETURN count(n) AS count').single()['count']:
                raise ValueError('Integration tests require an EMPTY disposable database')
            session.execute_write(cls.seed)

    @staticmethod
    def seed(tx):
        base = Path(__file__).resolve().parents[1]
        for filename in CYPHER_FILES:
            for statement in iter_statements((base / filename).read_text()):
                tx.run(statement).consume()
        apply_contract(tx, load_contract())

    def setUp(self):
        self.session = self.driver.session()
        self.addCleanup(self.session.close)
        self.tx = self.session.begin_transaction()
        self.addCleanup(self.tx.close)  # All per-test writes roll back.

    def legacy_graph(self):
        for parent, child in CROSS_AGENT:
            self.tx.run('MATCH (a:Goal {id:$a})-[d:DEPENDS_ON {type:"ACHIEVED"}]->(b:Goal {id:$b}) '
                        'DELETE d CREATE (a)-[:REFINES {type:"AND"}]->(b)', a=parent, b=child).consume()
        return graph_snapshot(self.tx)

    def test_seed_replay_preserves_graph_and_agent_scopes(self):
        before = graph_snapshot(self.tx)
        self.assertEqual(conversion_plan(before), [])
        self.assertEqual({label: sum(label in n['labels'] for n in before['nodes'])
                          for label in ('Goal', 'Task', 'Agent')}, {'Goal': 44, 'Task': 28, 'Agent': 9})
        self.seed(self.tx)
        self.assertEqual(canonical(graph_snapshot(self.tx)), canonical(before))
        for root, goals, tasks in [('G_WT_FULFILL_OPERATIONS', 5, 5),
                                    ('G_WT_TRANSPORT', 10, 6), ('G_WT_CROSSFLOOR', 7, 4)]:
            row = self.tx.run('MATCH (:Goal {id:$root})-[:REFINES*0..]->(g:Goal) '
                              'OPTIONAL MATCH (g)-[:OPERATIONALIZED_BY]->(t:Task) '
                              'RETURN count(DISTINCT g) AS goals, count(DISTINCT t) AS tasks', root=root).single()
            self.assertEqual((row['goals'], row['tasks']), (goals, tasks))

    def test_apply_twice_rollback_twice_and_exact_preservation(self):
        before = self.legacy_graph()
        changes = conversion_plan(before)
        self.assertEqual({(c['parent'], c['child']) for c in changes}, CROSS_AGENT)
        migrate(self.tx, before, changes)
        after = graph_snapshot(self.tx)
        self.assertEqual(conversion_plan(after), [])
        migrate(self.tx, before, changes)
        self.assertEqual(graph_snapshot(self.tx), after)
        migrate(self.tx, before, changes, rollback=True)
        self.assertEqual(canonical(graph_snapshot(self.tx)), canonical(before))
        migrate(self.tx, before, changes, rollback=True)

    def test_seed_removes_obsolete_refinements_and_retains_five_dependencies(self):
        before = self.legacy_graph()
        expected = expected_snapshot(before, conversion_plan(before))
        self.seed(self.tx)
        self.assertEqual(canonical(graph_snapshot(self.tx)), canonical(expected))

    def test_existing_dependency_survives_apply_and_rollback(self):
        self.legacy_graph()
        self.tx.run('MATCH (a:Goal {id:"G_WT_INFRA"}), (b:Goal {id:"G_CV_PROVIDE_MATERIAL_FLOW"}) '
                    'CREATE (a)-[:DEPENDS_ON {type:"ACHIEVED", description:"existing"}]->(b)').consume()
        before = graph_snapshot(self.tx)
        changes = conversion_plan(before)
        migrate(self.tx, before, changes)
        migrate(self.tx, before, changes, rollback=True)
        self.assertEqual(canonical(graph_snapshot(self.tx)), canonical(before))

    def test_concurrent_change_refuses_writes(self):
        before = self.legacy_graph()
        changes = conversion_plan(before)
        self.tx.run('MATCH (g:Goal {id:"G_WT_INFRA"}) SET g.description="changed"').consume()
        edited = graph_snapshot(self.tx)
        with self.assertRaisesRegex(ValueError, 'Graph changed'):
            migrate(self.tx, before, changes)
        self.assertEqual(graph_snapshot(self.tx), edited)


if __name__ == '__main__':
    unittest.main()

"""Convert cross-agent REFINES into DEPENDS_ON (ACHIEVED).

Default: read-only preview. --apply requires a new --journal path; repeat the
same command to verify/recover an applied migration. --rollback restores the
journal's edges. Both write modes verify the graph and use one transaction.
The graph must remain unchanged between preview/apply/rollback. Journals contain
graph data, not credentials, and are written with private permissions.
"""
from __future__ import annotations

import argparse
import copy
import json
from collections import defaultdict
from pathlib import Path

from migrate_goal_ids import graph_snapshot, save_journal
from seed_neo4j import load_config


def canonical(snapshot):
    """Relationship IDs change on replacement/rollback; all other data must match."""
    return {
        'nodes': sorted(snapshot['nodes'], key=lambda n: n['key']),
        'edges': sorted(
            [{k: v for k, v in edge.items() if k != 'key'} for edge in snapshot['edges']],
            key=lambda edge: json.dumps(edge, sort_keys=True),
        ),
    }


def conversion_plan(snapshot):
    nodes = {n['key']: n for n in snapshot['nodes']}
    goals = {key for key, n in nodes.items() if 'Goal' in n['labels']}
    parents, assigned = defaultdict(set), defaultdict(set)
    refinements = []
    for edge in snapshot['edges']:
        if edge['type'] == 'REFINES' and edge['a'] in goals and edge['b'] in goals:
            parents[edge['b']].add(edge['a'])
            refinements.append(edge)
        elif (edge['type'] == 'DELEGATED_TO' and edge['a'] in goals
              and 'Agent' in nodes[edge['b']]['labels']):
            assigned[edge['a']].add(edge['b'])

    def identifier(key):
        return nodes[key]['props'].get('id', key)

    def owner(goal):
        frontier, visited = {goal}, set()
        while frontier:
            owners = set().union(*(assigned[g] for g in frontier))
            if owners:
                if len(owners) != 1:
                    raise ValueError(f'Ambiguous nearest agent for {identifier(goal)}: '
                                     f'{sorted(identifier(a) for a in owners)}')
                return next(iter(owners))
            visited.update(frontier)
            frontier = set().union(*(parents[g] for g in frontier)) - visited
        raise ValueError(f'Missing responsible agent for {identifier(goal)}')

    # Resolve against the complete ORIGINAL graph, before removing any edges.
    owners = {g: owner(g) for g in {e[k] for e in refinements for k in ('a', 'b')}}
    changes, pairs = [], set()
    for edge in refinements:
        a, b = edge['a'], edge['b']
        if owners[a] == owners[b]:
            continue
        if edge['props'].get('type', 'AND') != 'AND':
            raise ValueError(f'Cross-agent OR/unknown refinement needs explicit modeling: '
                             f'{identifier(a)} -> {identifier(b)}')
        if (a, b) in pairs:
            raise ValueError(f'Duplicate refinement: {identifier(a)} -> {identifier(b)}')
        pairs.add((a, b))
        existing = [e for e in snapshot['edges'] if e['a'] == a and e['b'] == b
                    and e['type'] == 'DEPENDS_ON' and e['props'].get('type') == 'ACHIEVED']
        if len(existing) > 1:
            raise ValueError(f'Duplicate ACHIEVED dependency: {identifier(a)} -> {identifier(b)}')
        previous = existing[0] if existing else None
        props = {**edge['props'], 'type': 'ACHIEVED'}
        if previous:
            for key, value in previous['props'].items():
                if key in props and props[key] != value:
                    raise ValueError(f'Conflicting dependency property {key}: '
                                     f'{identifier(a)} -> {identifier(b)}')
            props.update(previous['props'])
        changes.append({
            'parent': identifier(a), 'child': identifier(b),
            'parentAgent': identifier(owners[a]), 'childAgent': identifier(owners[b]),
            'refinement': copy.deepcopy(edge), 'previousDependency': copy.deepcopy(previous),
            'dependency': {'a': a, 'b': b, 'type': 'DEPENDS_ON', 'props': props},
        })
    return sorted(changes, key=lambda c: (c['parent'], c['child']))


def expected_snapshot(before, changes):
    after = copy.deepcopy(before)
    for change in changes:
        removed = {change['refinement']['key']}
        if change['previousDependency']:
            removed.add(change['previousDependency']['key'])
        after['edges'] = [e for e in after['edges'] if e['key'] not in removed]
        after['edges'].append({**copy.deepcopy(change['dependency']),
                               'key': f"planned:{change['refinement']['key']}"})
    return after


def migrate(tx, before, changes, rollback=False):
    after = expected_snapshot(before, changes)
    source, target = (after, before) if rollback else (before, after)
    current = graph_snapshot(tx)
    if canonical(current) == canonical(target):
        return  # Includes recovery after commit but before the journal was updated.
    if canonical(current) != canonical(source):
        raise ValueError('Graph changed since the journal snapshot; no changes applied')

    for change in changes:
        old = change['refinement']
        dependency = change['dependency']
        previous = change['previousDependency']
        # Locate the current relationship by endpoints/type/properties, since a
        # rollback recreates it with a new Neo4j relationship ID.
        def locate(expected):
            matches = [e for e in current['edges'] if all(
                e[k] == expected[k] for k in ('a', 'b', 'type', 'props'))]
            if len(matches) != 1:
                raise ValueError('Expected one relationship to update')
            return matches[0]['key']

        def delete(edge):
            tx.run('MATCH ()-[r]->() WHERE elementId(r)=$key DELETE r', key=locate(edge)).consume()

        def create(edge):
            rel_type = edge['type']
            if rel_type not in ('REFINES', 'DEPENDS_ON'):
                raise ValueError('Unsupported relationship type')
            tx.run('MATCH (a:Goal), (b:Goal) WHERE elementId(a)=$a AND elementId(b)=$b '
                   f'CREATE (a)-[r:{rel_type}]->(b) SET r=$props',
                   a=edge['a'], b=edge['b'], props=edge['props']).consume()

        def update(edge, props):
            tx.run('MATCH ()-[r]->() WHERE elementId(r)=$key SET r=$props',
                   key=locate(edge), props=props).consume()

        if rollback:
            if previous:
                update(dependency, previous['props'])
            else:
                delete(dependency)
            create(old)
        else:
            if previous:
                update(previous, dependency['props'])
            else:
                create(dependency)
            delete(old)
    if canonical(graph_snapshot(tx)) != canonical(target):
        raise ValueError('Graph changed beyond the planned relationship conversion')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--apply', action='store_true')
    modes.add_argument('--rollback', action='store_true')
    parser.add_argument('--journal', type=Path)
    args = parser.parse_args()
    if (args.apply or args.rollback) and not args.journal:
        parser.error('--journal is required for writes')
    if args.rollback and not args.journal.exists():
        parser.error('Rollback journal does not exist')

    from neo4j import GraphDatabase
    uri, user, password, database = load_config()
    target = {'neo4j': uri, 'database': database}
    with GraphDatabase.driver(uri, auth=(user, password)) as driver:
        with driver.session(database=database, default_access_mode='READ') as session:
            if args.journal and args.journal.exists():
                journal = json.loads(args.journal.read_text())
                if journal.get('kind') != 'goal-dependencies-v1' or journal['target'] != target:
                    raise ValueError('Journal belongs to a different migration or database')
                if journal['phase'] == 'rolled_back' and not args.rollback:
                    raise ValueError('Use a new journal after rollback')
            else:
                before = session.execute_read(graph_snapshot)
                journal = {'kind': 'goal-dependencies-v1', 'target': target, 'phase': 'planned',
                           'graphBackup': before, 'changes': conversion_plan(before)}
        print(f"Plan: {len(journal['changes'])} cross-agent refinements")
        for change in journal['changes']:
            print(f"  {change['parent']} ({change['parentAgent']}) -> "
                  f"{change['child']} ({change['childAgent']})")
        if not args.apply and not args.rollback:
            print('Read-only preview; no changes committed')
            return
        # Backup must be durable BEFORE opening the write transaction.
        save_journal(args.journal, journal)
        with driver.session(database=database) as session:
            session.execute_write(migrate, journal['graphBackup'], journal['changes'], args.rollback)
        journal['phase'] = 'rolled_back' if args.rollback else 'complete'
        save_journal(args.journal, journal)
        print(f"Migration {journal['phase']}; journal: {args.journal}")


if __name__ == '__main__':
    main()

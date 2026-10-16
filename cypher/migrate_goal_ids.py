"""Rename existing goals and update Ditto anchors without recreating nodes.

Default: read-only plan. --apply requires --journal (private backup + resume log).
--check-seeds validates all seeds inside a transaction which is rolled back.
--rollback restores only this journal's changes, checking for concurrent edits.
Run with the simulator venv from the repository root. Stop mapping publishers first.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from seed_neo4j import CYPHER_FILES, iter_statements, load_config

ROOT = Path(__file__).resolve().parents[1]
RENAMES = json.loads((ROOT / 'goal_model/ids.json').read_text())
FIELDS = ('goalRootId', 'goalAgentId', 'agentGoalRootId')


def scope_id(value):
    if not isinstance(value, str):
        return value
    canonical = RENAMES.get(value, value)
    return {
        'G_R_EXECUTE_TRANSPORT': 'G_WT_TRANSPORT',
        'G_LT_PROVIDE_VERTICAL_TRANSPORT': 'G_WT_CROSSFLOOR',
    }.get(canonical, canonical)


def attribute_changes(attributes):
    return {key: scope_id(attributes[key]) for key in FIELDS
            if key in attributes and scope_id(attributes[key]) != attributes[key]}


def graph_snapshot(tx):
    nodes = tx.run('MATCH (n) RETURN elementId(n) AS key, labels(n) AS labels, properties(n) AS props').data()
    edges = tx.run('MATCH (a)-[r]->(b) RETURN elementId(r) AS key, elementId(a) AS a, '
                   'elementId(b) AS b, type(r) AS type, properties(r) AS props').data()
    for node in nodes:
        node['labels'].sort()
    return {'nodes': sorted(nodes, key=lambda n: n['key']), 'edges': sorted(edges, key=lambda e: e['key'])}


def rename_plan(snapshot, mapping=RENAMES):
    changes = []
    for old, new in mapping.items():
        before = [n for n in snapshot['nodes'] if 'Goal' in n['labels'] and n['props'].get('id') == old]
        after = [n for n in snapshot['nodes'] if 'Goal' in n['labels'] and n['props'].get('id') == new]
        if len(before) + len(after) != 1:
            raise ValueError(f'Expected exactly one Goal for {old} / {new}; found {len(before)} / {len(after)}')
        if before:
            changes.append({'key': before[0]['key'], 'old': old, 'new': new})
    return changes


def rename_nodes(tx, changes):
    before = graph_snapshot(tx)
    expected = copy.deepcopy(before)
    by_key = {n['key']: n for n in expected['nodes']}
    for change in changes:
        node = by_key.get(change['key'])
        if not node or node['props'].get('id') not in (change['old'], change['new']):
            raise ValueError('Goal changed since the migration plan was created')
        conflicts = [n for n in expected['nodes'] if n['key'] != change['key']
                     and 'Goal' in n['labels'] and n['props'].get('id') in (change['old'], change['new'])]
        if conflicts:
            raise ValueError('Conflicting goal ID; refusing to merge nodes')
        tx.run('MATCH (g:Goal) WHERE elementId(g)=$key AND g.id IN [$old,$new] '
               'SET g.id=$new', **change).consume()
        node['props']['id'] = change['new']
    if graph_snapshot(tx) != expected:
        raise ValueError('Graph changed beyond the planned ID renames')


def check_seeds(session, changes):
    with session.begin_transaction() as tx:
        rename_nodes(tx, changes)
        before = graph_snapshot(tx)
        for filename in CYPHER_FILES:
            for statement in iter_statements((ROOT / 'cypher' / filename).read_text()):
                tx.run(statement).consume()
        if graph_snapshot(tx) != before:
            raise ValueError('Seeds would change graph data beyond the ID migration')
        tx.rollback()
    print('Seeds: unchanged graph after replay (transaction rolled back)')


class Ditto:
    def __init__(self, base):
        self.base = base.rstrip('/')

    def request(self, path, method='GET', body=None, etag=None):
        headers = {'Accept': 'application/json'}
        if body is not None:
            headers['Content-Type'] = 'application/merge-patch+json'
        if etag:
            headers['If-Match'] = etag
        req = Request(self.base + path, method=method, headers=headers,
                      data=None if body is None else json.dumps(body).encode())
        with urlopen(req, timeout=20) as response:
            raw = response.read()
            return (json.loads(raw) if raw else None), response.headers.get('ETag')

    def things(self):
        cursor = None
        while True:
            option = f'cursor({cursor})' if cursor else 'size(200)'
            page, _ = self.request('/search/things?' + urlencode({
                'option': option, 'fields': 'thingId,attributes/goalRootId,attributes/goalAgentId,attributes/agentGoalRootId'}))
            yield from page['items']
            cursor = page.get('cursor')
            if not cursor:
                break

    def plan(self):
        plans = []
        for item in self.things():
            if not attribute_changes(item.get('attributes', {})):
                continue
            thing, etag = self.request('/things/' + quote(item['thingId'], safe=''))
            attrs = thing.get('attributes', {})
            changes = attribute_changes(attrs)
            if changes:
                if not etag:
                    raise ValueError('Ditto did not supply an ETag')
                plans.append({'thingId': thing['thingId'], 'before': {k: attrs[k] for k in changes},
                              'after': changes, 'attributesBackup': attrs, 'etag': etag, 'status': 'pending'})
        return sorted(plans, key=lambda p: p['thingId'])

    def update(self, plan, rollback=False):
        path = '/things/' + quote(plan['thingId'], safe='')
        expected, desired = (plan['after'], plan['before']) if rollback else (plan['before'], plan['after'])
        # Retry only unrelated telemetry revision races. Mapping changes are conflicts.
        for _ in range(5):
            thing, etag = self.request(path)
            current = {k: thing.get('attributes', {}).get(k) for k in desired}
            if current == desired:
                return
            if current != expected:
                raise ValueError(f"Concurrent mapping change on {plan['thingId']}")
            if not etag:
                raise ValueError('Ditto did not supply an ETag')
            try:
                self.request(path, 'PATCH', {'attributes': desired}, etag)
            except HTTPError as exc:
                if exc.code == 412:
                    continue
                raise
            updated, _ = self.request(path)
            if any(updated.get('attributes', {}).get(k) != v for k, v in desired.items()):
                raise ValueError(f"Mapping verification failed: {plan['thingId']}")
            return
        raise ValueError(f"Ditto revision kept changing: {plan['thingId']}")


def save_journal(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.flush()
        os.fsync(file.fileno())
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--apply', action='store_true')
    modes.add_argument('--rollback', action='store_true')
    parser.add_argument('--journal', type=Path)
    parser.add_argument('--check-seeds', action='store_true')
    parser.add_argument('--ditto-base', default='http://localhost:8081/api/2')
    args = parser.parse_args()
    if (args.apply or args.rollback) and not args.journal:
        parser.error('--journal is required for writes')
    if args.rollback and not args.journal.exists():
        parser.error('Rollback journal does not exist')
    from neo4j import GraphDatabase
    uri, user, password, database = load_config()
    ditto = Ditto(args.ditto_base)
    target = {'neo4j': uri, 'database': database, 'ditto': ditto.base}
    with GraphDatabase.driver(uri, auth=(user, password)) as driver, driver.session(database=database) as session:
        if args.journal and args.journal.exists():
            journal = json.loads(args.journal.read_text())
            if journal['target'] != target:
                raise ValueError('Journal targets a different database or Ditto endpoint')
            if journal['phase'] == 'rolled_back' and not args.rollback:
                raise ValueError('Use a new journal after a rollback')
        else:
            snapshot = graph_snapshot(session)
            journal = {'version': 1, 'target': target, 'phase': 'planned', 'graphBackup': snapshot,
                       'renames': rename_plan(snapshot), 'things': ditto.plan()}
        print(f"Plan: {len(journal['renames'])} goal renames, {len(journal['things'])} Thing updates")
        if args.check_seeds:
            check_seeds(session, journal['renames'])
        if not args.apply and not args.rollback:
            print('Read-only plan; no changes committed')
            return
        if args.rollback:
            # Also covers a crash after PATCH but before the journal status was saved.
            for plan in reversed(journal['things']):
                ditto.update(plan, rollback=True)
                plan['status'] = 'rolled_back'
                save_journal(args.journal, journal)
            reverse = [dict(c, old=c['new'], new=c['old']) for c in journal['renames']]
            session.execute_write(lambda tx: rename_nodes(tx, reverse))
            journal['phase'] = 'rolled_back'
        else:
            save_journal(args.journal, journal)
            session.execute_write(lambda tx: rename_nodes(tx, journal['renames']))
            journal['phase'] = 'neo4j_applied'
            save_journal(args.journal, journal)
            for plan in journal['things']:
                ditto.update(plan)
                plan['status'] = 'applied'
                save_journal(args.journal, journal)
            journal['phase'] = 'complete'
        save_journal(args.journal, journal)
        print(f"Migration {journal['phase']}; journal: {args.journal}")


if __name__ == '__main__':
    main()

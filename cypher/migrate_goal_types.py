"""Normalize the 32 WareTwin Goal.type values without reseeding topology.

Default: read-only preview. --apply requires --journal; --rollback restores
the journal's original types. Repeating an applied migration is a no-op.
"""
from __future__ import annotations

import argparse
import copy
import json
import re
from collections import Counter
from pathlib import Path

from migrate_goal_ids import graph_snapshot, save_journal
from robot_contract import load_contract, walk_goals
from seed_neo4j import load_config

ROOT = Path(__file__).resolve().parents[1]
GOAL_TYPES = {"Achieve", "Maintain", "Avoid"}


def load_goal_types(cypher_dir=ROOT / "cypher", model=None):
    """The Cypher declarations are authoritative; Robot JSON must agree."""
    mapping = {}
    for path in sorted(cypher_dir.glob("waretwin_*_kg.md")):
        text = path.read_text(encoding="utf-8")
        for match in re.finditer(r"MERGE\s*\((\w+):Goal\s*\{id:\s*'([^']+)'\}\)(.*?);", text, re.S):
            variable, identifier, body = match.groups()
            types = re.findall(rf"\b{re.escape(variable)}\.type\s*=\s*'([^']+)'", body)
            if identifier in mapping or len(types) != 1 or types[0] not in GOAL_TYPES:
                raise ValueError(f"Duplicate goal or missing/invalid type: {identifier}")
            mapping[identifier] = types[0]
    if len(mapping) != 32 or Counter(mapping.values()) != {"Achieve": 20, "Maintain": 9, "Avoid": 3}:
        raise ValueError("Expected 32 WareTwin goals: 20 Achieve, 9 Maintain, 3 Avoid")
    for goal in walk_goals((model if model is not None else load_contract())["goal"]):
        if mapping.get(goal["id"]) != goal["type"]:
            raise ValueError(f"Cypher/Robot type mismatch: {goal['id']}")
    return mapping


def type_plan(snapshot, mapping):
    changes = []
    for identifier, desired in sorted(mapping.items()):
        matches = [n for n in snapshot["nodes"]
                   if "Goal" in n["labels"] and n["props"].get("id") == identifier]
        if len(matches) != 1:
            raise ValueError(f"Expected one Goal {identifier}; found {len(matches)}")
        node = matches[0]
        if node["props"].get("type") != desired:
            changes.append({"key": node["key"], "id": identifier,
                            "old": node["props"].get("type"), "new": desired})
    return changes


def expected_snapshot(before, changes):
    after = copy.deepcopy(before)
    nodes = {node["key"]: node for node in after["nodes"]}
    for change in changes:
        nodes[change["key"]]["props"]["type"] = change["new"]
    return after


def migrate(tx, before, changes, mapping, rollback=False):
    # Lock scoped nodes before reading/comparing. The direct property dependency
    # acquires Neo4j write locks before reading, preventing lost type updates.
    tx.run("MATCH (g:Goal) WHERE g.id IN $ids "
           "SET g.type = g.type RETURN count(g) AS count", ids=sorted(mapping)).consume()
    current = graph_snapshot(tx)
    type_plan(current, mapping)  # Also rejects missing/duplicate IDs on resume.
    after = expected_snapshot(before, changes)
    source, target = (after, before) if rollback else (before, after)
    if current == target:
        return
    if current != source:
        raise ValueError("Graph changed since the journal snapshot; no changes applied")
    for change in changes:
        result = tx.run(
            "MATCH (g:Goal {id: $id}) WHERE elementId(g) = $key "
            "SET g.type = $value RETURN count(g) AS count",
            id=change["id"], key=change["key"],
            value=change["old"] if rollback else change["new"],
        ).single()
        if result["count"] != 1:
            raise ValueError(f"Expected one Goal: {change['id']}")
    if graph_snapshot(tx) != target:
        raise ValueError("Graph changed beyond the planned goal types")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--apply", action="store_true")
    modes.add_argument("--rollback", action="store_true")
    parser.add_argument("--journal", type=Path)
    args = parser.parse_args()
    if (args.apply or args.rollback) and not args.journal:
        parser.error("--journal is required for writes")
    if args.rollback and not args.journal.exists():
        parser.error("Rollback journal does not exist")

    from neo4j import GraphDatabase
    mapping = load_goal_types()
    uri, user, password, database = load_config()
    target = {"neo4j": uri, "database": database}
    with GraphDatabase.driver(uri, auth=(user, password)) as driver:
        with driver.session(database=database, default_access_mode="READ") as session:
            current = session.execute_read(graph_snapshot)
        if args.journal and args.journal.exists():
            journal = json.loads(args.journal.read_text())
            if (journal.get("kind") != "waretwin-goal-types-v1"
                    or journal["target"] != target or journal["mapping"] != mapping):
                raise ValueError("Journal belongs to a different migration, mapping or database")
            if journal["phase"] == "rolled_back" and not args.rollback:
                raise ValueError("Use a new journal after rollback")
        else:
            journal = {"kind": "waretwin-goal-types-v1", "target": target, "mapping": mapping,
                       "phase": "planned", "graphBackup": current,
                       "changes": type_plan(current, mapping)}
        changes = type_plan(current, mapping)
        print(f"WareTwin: {len(mapping)} goals; {len(changes)} types differ from source")
        for change in changes:
            print(f"  {change['id']}: {change['old']} -> {change['new']}")
        if not args.apply and not args.rollback:
            print("Read-only preview; no changes committed")
            return
        save_journal(args.journal, journal)
        with driver.session(database=database) as session:
            session.execute_write(migrate, journal["graphBackup"], journal["changes"], mapping, args.rollback)
        journal["phase"] = "rolled_back" if args.rollback else "complete"
        save_journal(args.journal, journal)
        print(f"Migration {journal['phase']}; journal: {args.journal}")


if __name__ == "__main__":
    main()

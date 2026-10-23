"""Apply WareTwin Task pre/postconditions from the six Cypher seed files.

Default: read-only preview. --validate-only checks the seeds offline.
--apply updates the existing tasks in one transaction and verifies the graph.
"""
from __future__ import annotations

import argparse
import copy
import re
from pathlib import Path

from migrate_goal_ids import graph_snapshot
from seed_neo4j import iter_statements, load_config

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ("precondition", "postcondition")
EXPECTED_IDS = {
    "T_R_NAVIGATE", "T_R_PICK", "T_R_DROP", "T_R_CHARGE", "T_R_RECHARGE", "T_R_AVOID",
    "T_LIFT_QUEUE", "T_LIFT_GATE", "T_LIFT_SERVE", "T_LIFT_RECOVER",
    "T_BELT_RUN", "T_BELT_FEED", "T_BELT_STOP", "T_ZONE_MONITOR", "T_ZONE_BLOCK",
    "T_VLM_DETECT", "T_SENSOR_REPORT", "T_ORDER_PICK", "T_ORDER_TRANSPORT",
    "T_ORDER_REPLENISH", "T_ORDER_RETURN", "T_FLEET_COLLECT_ENERGY",
}


def load_conditions(cypher_dir=ROOT / "cypher"):
    """Read through the seed splitter so unsupported semicolons fail validation."""
    mapping = {}
    declaration = re.compile(r"MERGE\s*\((\w+):Task\s*\{id:\s*'([^']+)'\}\)")
    for path in sorted(cypher_dir.glob("waretwin_*_kg.md")):
        for statement in iter_statements(path.read_text(encoding="utf-8")):
            match = declaration.match(statement)
            if not match:
                continue
            variable, identifier = match.groups()
            if identifier in mapping:
                raise ValueError(f"Duplicate task declaration: {identifier}")
            props = {}
            for field in FIELDS:
                values = re.findall(
                    rf"\b{re.escape(variable)}\.{field}\s*=\s*'([^']*)'(?=\s*(?:,|$))", statement
                )
                if len(values) != 1 or not values[0].strip():
                    raise ValueError(f"Missing/invalid {field}: {identifier}")
                props[field] = values[0]
            mapping[identifier] = props
    if set(mapping) != EXPECTED_IDS:
        raise ValueError(f"Expected exactly 22 WareTwin tasks; missing={sorted(EXPECTED_IDS - set(mapping))}, "
                         f"unexpected={sorted(set(mapping) - EXPECTED_IDS)}")
    return mapping


def condition_plan(snapshot, mapping):
    changes = []
    for identifier, props in sorted(mapping.items()):
        matches = [n for n in snapshot["nodes"]
                   if "Task" in n["labels"] and n["props"].get("id") == identifier]
        if len(matches) != 1:
            raise ValueError(f"Expected one Task {identifier}; found {len(matches)}")
        node = matches[0]
        if any(node["props"].get(field) != value for field, value in props.items()):
            changes.append({"id": identifier, "key": node["key"], "props": props})
    return changes


def migrate(tx, mapping):
    # Lock the scoped tasks before taking the comparison snapshot.
    tx.run("MATCH (t:Task) WHERE t.id IN $ids "
           "SET t.precondition = t.precondition RETURN count(t) AS count",
           ids=sorted(mapping)).consume()
    before = graph_snapshot(tx)
    changes = condition_plan(before, mapping)
    expected = copy.deepcopy(before)
    nodes = {node["key"]: node for node in expected["nodes"]}
    for change in changes:
        result = tx.run(
            "MATCH (t:Task {id: $id}) WHERE elementId(t) = $key "
            "SET t.precondition = $precondition, t.postcondition = $postcondition "
            "RETURN count(t) AS count",
            id=change["id"], key=change["key"], **change["props"],
        ).single()
        if result["count"] != 1:
            raise ValueError(f"Expected one Task: {change['id']}")
        nodes[change["key"]]["props"].update(change["props"])
    if graph_snapshot(tx) != expected:
        raise ValueError("Graph changed beyond the planned task conditions")
    return len(changes)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--apply", action="store_true")
    modes.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    mapping = load_conditions()
    if args.validate_only:
        print(f"Validated {len(mapping)} WareTwin tasks, each with precondition and postcondition")
        return

    from neo4j import GraphDatabase

    uri, user, password, database = load_config()
    with GraphDatabase.driver(uri, auth=(user, password)) as driver:
        driver.verify_connectivity()
        if args.apply:
            with driver.session(database=database) as session:
                changed = session.execute_write(migrate, mapping)
            with driver.session(database=database, default_access_mode="READ") as session:
                if condition_plan(session.execute_read(graph_snapshot), mapping):
                    raise ValueError("Post-commit task conditions differ from seeds")
            print(f"Updated {changed} tasks; verified all {len(mapping)} match the seeds")
        else:
            with driver.session(database=database, default_access_mode="READ") as session:
                changes = condition_plan(session.execute_read(graph_snapshot), mapping)
            print(f"WareTwin: {len(mapping)} tasks; {len(changes)} need condition updates")
            for change in changes:
                print(f"  {change['id']}")
            print("Read-only preview; use --apply to commit")


if __name__ == "__main__":
    main()

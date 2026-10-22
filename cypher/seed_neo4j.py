"""Seed the goal knowledge graph into the configured Neo4j instance.

Reads the Cypher model files in this folder and executes them in the
documented order:

    1. kettle_kg.md
    2. grinder_kg.md
    3. system_kg.md
    4. integration_relations.md
    5. WareTwin component, system and integration files
    6. Robot goal/dependency contract from goal_model/waretwin_robot.json

Credentials are read from the process environment, falling back to the
simulators' ``.env`` files (NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD).
``NEO4J_USERNAME`` and ``NEO4J_DATABASE`` are also accepted (Neo4j Aura
naming).

Usage (from the repository root, with a venv that has the ``neo4j`` driver):

    smart_kettle_simulator/.venv/bin/python cypher/seed_neo4j.py
    python cypher/seed_neo4j.py --validate-only
    smart_kettle_simulator/.venv/bin/python cypher/seed_neo4j.py --waretwin-only
"""

from __future__ import annotations

import os
import json
import sys
import argparse
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover

    def load_dotenv(*_args, **_kwargs) -> bool:
        return False


CYPHER_FILES = [
    "kettle_kg.md",
    "grinder_kg.md",
    "system_kg.md",
    "integration_relations.md",
    # WareTwin goal KG (component DTs on Eclipse Ditto → goal graph).
    # Component files trước, system + integration sau cùng.
    "waretwin_robot_kg.md",
    "waretwin_lift_kg.md",
    "waretwin_conveyor_kg.md",
    "waretwin_zone_kg.md",
    "waretwin_perception_kg.md",
    "waretwin_system_kg.md",
    "waretwin_integration_relations.md",
]


def iter_statements(text: str):
    """Yield non-empty Cypher statements, dropping comment-only lines."""
    for raw in text.split(";"):
        lines = [
            line
            for line in raw.splitlines()
            if line.strip() and not line.strip().startswith("//")
        ]
        statement = "\n".join(lines).strip()
        if statement:
            yield statement


def load_config() -> tuple[str, str, str, str | None]:
    repo_root = Path(__file__).resolve().parents[1]
    for env_path in (
        repo_root / "smart_kettle_simulator" / ".env",
        repo_root / "smart_grinder_simulator" / ".env",
    ):
        if env_path.exists():
            load_dotenv(env_path)

    uri = os.getenv("NEO4J_URI", "").strip()
    user = (os.getenv("NEO4J_USER") or os.getenv("NEO4J_USERNAME") or "").strip()
    password = os.getenv("NEO4J_PASSWORD", "").strip()
    database = os.getenv("NEO4J_DATABASE", "").strip() or None

    missing = [
        name
        for name, value in (("NEO4J_URI", uri), ("NEO4J_USER", user), ("NEO4J_PASSWORD", password))
        if not value
    ]
    if missing:
        raise SystemExit(f"Missing configuration: {', '.join(missing)}")
    return uri, user, password, database


def main() -> int:
    from robot_contract import apply_contract, counts, load_contract

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--waretwin-only", action="store_true", help="Seed only WareTwin topology and Robot contract")
    parser.add_argument("--validate-only", action="store_true", help="Validate Robot contract without connecting to Neo4j")
    args = parser.parse_args()
    contract = load_contract()
    if args.validate_only:
        goals, deps = counts(contract)
        print(f"[validate] Robot: {goals} goals, {deps} dependencies")
        return 0

    from neo4j import GraphDatabase

    uri, user, password, database = load_config()
    base_dir = Path(__file__).resolve().parent

    print(f"[seed] Connecting to {uri} as {user} (db={database or 'default'})")
    driver = GraphDatabase.driver(uri, auth=(user, password))
    try:
        driver.verify_connectivity()
        old_ids = list(json.loads((base_dir.parent / "goal_model" / "ids.json").read_text()))
        with driver.session(database=database) as session:
            legacy = session.run(
                "MATCH (g:Goal) WHERE g.id IN $ids RETURN collect(g.id) AS ids", ids=old_ids
            ).single()["ids"]
        if legacy:
            raise SystemExit("Legacy Goal IDs found. Run cypher/migrate_goal_ids.py before seeding.")
        for filename in CYPHER_FILES:
            if args.waretwin_only and not filename.startswith("waretwin_"):
                continue
            path = base_dir / filename
            if not path.exists():
                raise FileNotFoundError(path)
            statements = list(iter_statements(path.read_text(encoding="utf-8")))
            print(f"[seed] {filename}: {len(statements)} statements")
            with driver.session(database=database) as session:
                for statement in statements:
                    session.run(statement)

        with driver.session(database=database) as session:
            session.execute_write(apply_contract, contract)
        print("[seed] Applied Robot goal conditions and dependency bindings")

        with driver.session(database=database) as session:
            counts = session.run(
                """
                MATCH (g:Goal) WITH count(g) AS goals
                MATCH (t:Task) WITH goals, count(t) AS tasks
                MATCH (a:Agent) WITH goals, tasks, count(a) AS agents
                RETURN goals, tasks, agents
                """
            ).single()
            print(
                f"[seed] Done. Goals={counts['goals']} "
                f"Tasks={counts['tasks']} Agents={counts['agents']}"
            )
    finally:
        driver.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())

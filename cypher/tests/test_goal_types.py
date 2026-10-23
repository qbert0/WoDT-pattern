"""Coverage and transaction regressions for WareTwin goal type migration."""
import copy
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from migrate_goal_types import expected_snapshot, load_goal_types, migrate, type_plan
from robot_contract import load_contract, validate_contract, walk_goals


class GraphTx:
    def __init__(self, snapshot):
        self.snapshot = copy.deepcopy(snapshot)
        self.writes = 0

    def run(self, query, **params):
        if "SET g.type = g.type" in query:
            return SimpleNamespace(consume=lambda: None)
        if "MATCH (n) RETURN" in query:
            return SimpleNamespace(data=lambda: copy.deepcopy(self.snapshot["nodes"]))
        if "MATCH (a)-[r]->(b) RETURN" in query:
            return SimpleNamespace(data=lambda: copy.deepcopy(self.snapshot["edges"]))
        if "SET g.type = $value" in query:
            matches = [n for n in self.snapshot["nodes"] if n["key"] == params["key"]
                       and n["props"]["id"] == params["id"]]
            for node in matches:
                if params["value"] is None:
                    node["props"].pop("type", None)
                else:
                    node["props"]["type"] = params["value"]
                self.writes += 1
            return SimpleNamespace(single=lambda: {"count": len(matches)})
        raise AssertionError(query)


class GoalTypesTests(unittest.TestCase):
    def setUp(self):
        self.mapping = load_goal_types()
        self.before = {"nodes": [
            {"key": identifier, "labels": ["Goal"],
             "props": {"id": identifier, "name": identifier, "description": "preserved"}}
            for identifier in sorted(self.mapping)
        ] + [{"key": "coffee", "labels": ["Goal"],
              "props": {"id": "G_S_MAKE_COFFEE", "type": "legacy"}}],
            "edges": [{"key": "edge", "a": "G_R_SAFE", "b": "G_P_DETECT",
                       "type": "DEPENDS_ON", "props": {"type": "ACHIEVED"}}]}
        self.before["nodes"][0]["props"]["type"] = "achieve"

    def test_exact_classification(self):
        maintain = {"G_WT_CROSSFLOOR", "G_WT_ENERGY", "G_WT_INFRA", "G_R_ENERGY",
                    "G_CV_PROVIDE_MATERIAL_FLOW", "G_CV_RUN", "G_Z_MAINTAIN_SAFE_TRAFFIC",
                    "G_Z_MONITOR", "G_P_PROVIDE_SITUATIONAL_AWARENESS"}
        avoid = {"G_WT_SAFETY", "G_R_SAFE", "G_LT_GATE"}
        achieve = {"G_WT_FULFILL_OPERATIONS", "G_WT_TRANSPORT", "G_WT_ALLOC",
                   "G_R_EXECUTE_TRANSPORT", "G_R_TRANSPORT", "G_R_NAVIGATE", "G_R_PICK",
                   "G_R_DROP", "G_R_REACH", "G_R_RECHARGE", "G_LT_PROVIDE_VERTICAL_TRANSPORT",
                   "G_LT_SERVE", "G_LT_QUEUE", "G_LT_RIDE", "G_LT_RECOVER", "G_CV_FEED",
                   "G_CV_REPORT", "G_Z_BLOCK", "G_P_DETECT", "G_P_TELEMETRY"}
        for kind, identifiers in (("Maintain", maintain), ("Avoid", avoid), ("Achieve", achieve)):
            self.assertEqual({key for key, value in self.mapping.items() if value == kind}, identifiers)

    def test_robot_accepts_avoid_and_rejects_invalid_types(self):
        model = load_contract()
        safety = next(g for g in walk_goals(model["goal"]) if g["id"] == "G_R_SAFE")
        self.assertEqual(safety["type"], "Avoid")
        self.assertIn("collision_free == true", safety["clause"])
        for invalid in ("avoid", "ACHIEVED", "AND", "", None):
            safety["type"] = invalid
            with self.assertRaisesRegex(ValueError, "Invalid goal"):
                validate_contract(model)

    def test_rejects_json_cypher_disagreement(self):
        model = load_contract()
        model["goal"]["type"] = "Maintain"
        with self.assertRaisesRegex(ValueError, "mismatch"):
            load_goal_types(model=model)

    def test_apply_reapply_rollback_preserve_graph(self):
        changes = type_plan(self.before, self.mapping)
        tx = GraphTx(self.before)
        migrate(tx, self.before, changes, self.mapping)
        self.assertEqual(tx.snapshot, expected_snapshot(self.before, changes))
        self.assertEqual(type_plan(tx.snapshot, self.mapping), [])
        self.assertEqual(tx.writes, 32)
        migrate(tx, self.before, changes, self.mapping)
        self.assertEqual(tx.writes, 32)
        migrate(tx, self.before, changes, self.mapping, rollback=True)
        self.assertEqual(tx.snapshot, self.before)
        migrate(tx, self.before, changes, self.mapping, rollback=True)
        self.assertEqual(tx.writes, 64)

    def test_missing_duplicate_and_concurrent_changes_rejected(self):
        changes = type_plan(self.before, self.mapping)
        missing = copy.deepcopy(self.before)
        missing["nodes"].pop(0)
        duplicate = copy.deepcopy(self.before)
        duplicate["nodes"].append(copy.deepcopy(duplicate["nodes"][0]))
        concurrent = copy.deepcopy(self.before)
        concurrent["nodes"][0]["props"]["description"] = "edited"
        concurrent_type = copy.deepcopy(self.before)
        concurrent_type["nodes"][0]["props"]["type"] = "Avoid"
        for snapshot in (missing, duplicate, concurrent, concurrent_type):
            tx = GraphTx(snapshot)
            with self.assertRaises(ValueError):
                migrate(tx, self.before, changes, self.mapping)
            self.assertEqual(tx.writes, 0)
        applied = GraphTx(self.before)
        migrate(applied, self.before, changes, self.mapping)
        applied.snapshot["edges"][0]["props"]["type"] = "PARAMETER"
        with self.assertRaisesRegex(ValueError, "Graph changed"):
            migrate(applied, self.before, changes, self.mapping, rollback=True)


if __name__ == "__main__":
    unittest.main()

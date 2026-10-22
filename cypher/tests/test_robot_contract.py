"""Regression tests for the simple Robot goal tree and legacy property migration."""
import copy
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from robot_contract import LEGACY_PROPERTIES, apply_contract, counts, dependencies, load_contract, validate_contract, walk_goals


class RobotContractTests(unittest.TestCase):
    def setUp(self):
        self.model = load_contract()

    def test_tree_covers_robot_goals_and_dependencies(self):
        self.assertEqual(counts(self.model), (10, 6))
        self.assertEqual(set(self.model), {"systemId", "participants", "goal", "parameter_dependency"})
        self.assertEqual(self.model["goal"]["id"], "G_WT_TRANSPORT")

    def test_rejects_duplicate_and_missing_goals(self):
        self.model["goal"]["children"].append(copy.deepcopy(self.model["goal"]["children"][0]))
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            validate_contract(self.model)
        self.model = load_contract()
        self.model["goal"]["children"].pop()
        with self.assertRaisesRegex(ValueError, "coverage"):
            validate_contract(self.model)

    def test_rejects_unknown_provider(self):
        self.model["goal"]["depends_on"]["goal"] = "G_MISSING"
        with self.assertRaisesRegex(ValueError, "endpoint"):
            validate_contract(self.model)

    def test_rejects_unknown_actor(self):
        self.model["goal"]["depends_on"]["actor"] = "MissingAgent"
        with self.assertRaisesRegex(ValueError, "dependency"):
            validate_contract(self.model)

    def test_lift_parameter_flows_from_navigation_request(self):
        dep = next(d for d in dependencies(self.model) if d[1] == "T_LIFT_SERVE")
        self.assertEqual(dep[2], "T_R_NAVIGATE")
        self.assertEqual(dep[4]["from"], "T_R_NAVIGATE.target_floor")
        self.assertEqual(dep[4]["when"], "Task.source_floor != Task.target_floor")

    def test_conditional_charging_and_bindings_survive_projection(self):
        dep = next(d for d in dependencies(self.model) if d[1] == "G_R_RECHARGE")
        self.assertEqual(dep[2], "G_R_REACH")
        self.assertEqual(dep[4]["when"], "RobotAgent.needs_charge == true")
        self.assertEqual(json.loads(dep[4]["binding"]), {"charger_id": "RobotAgent.charger_id"})

    def test_migration_clears_old_properties_and_writes_small_model(self):
        calls = []
        class Tx:
            def run(self, query, **kwargs):
                calls.append((query, kwargs))
                return SimpleNamespace(consume=lambda: None, single=lambda: {"count": 1})
        apply_contract(Tx(), self.model)
        self.assertEqual(len([c for c in calls if "cleanup" in c[1]]), 2)
        updates = [c[1]["props"] for c in calls if "props" in c[1]]
        self.assertEqual(len(updates), 16)
        for props in updates:
            self.assertTrue(all(props[key] is None for key in LEGACY_PROPERTIES))
            self.assertFalse(any(isinstance(value, dict) for value in props.values()))
        self.assertEqual(updates[0]["type"], "Achieve")
        self.assertEqual(updates[0]["systemId"], "WareTwinRobot")

    def test_projection_rejects_missing_graph_nodes(self):
        class Tx:
            def run(self, query, **kwargs):
                return SimpleNamespace(consume=lambda: None, single=lambda: {"count": 0})
        with self.assertRaisesRegex(ValueError, "Expected one goal"):
            apply_contract(Tx(), self.model)


if __name__ == "__main__":
    unittest.main()

"""Regression checks for seed coverage and the scoped condition migration."""
import ast
import copy
import io
import re
import sys
import tokenize
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from migrate_task_conditions import EXPECTED_IDS, FIELDS, condition_plan, load_conditions, migrate


def parse_specification(value, signatures):
    """Syntax-only check of the documented notation; never evaluate conditions."""
    if any(c in value for c in "';\\\n"):
        raise ValueError("Unsafe seed literal")
    substitutions = {"AND": "and", "OR": "or", "NOT": "not", "IN": "in",
                     "true": "True", "false": "False", "null": "None"}
    tokens = []
    for token in tokenize.generate_tokens(io.StringIO(value).readline):
        spelling = token.string
        if token.type == tokenize.NAME:
            if spelling in substitutions.values():
                raise ValueError("Use specification operators/literals")
            spelling = substitutions.get(spelling, spelling)
        elif token.type == tokenize.STRING and not spelling.startswith('"'):
            raise ValueError("Use double-quoted strings")
        tokens.append((token.type, spelling))
    tree = ast.parse(tokenize.untokenize(tokens), mode="eval")
    roots = {"Robot", "Task", "Lift", "Conveyor", "Zone", "Camera", "Sensor",
             "input", "output", "before", "state", "tick", "runtime", "layout",
             "context", "charger_busy", "blocked_zones", "SIM"}
    allowed = (ast.Expression, ast.BoolOp, ast.UnaryOp, ast.BinOp, ast.Compare,
               ast.Attribute, ast.Subscript, ast.List, ast.Dict, ast.Constant,
               ast.Load, ast.And, ast.Or, ast.Not, ast.USub, ast.Add, ast.Sub,
               ast.Mult, ast.Div, ast.Mod, ast.Eq, ast.NotEq, ast.Lt, ast.LtE,
               ast.Gt, ast.GtE, ast.In, ast.NotIn)

    def visit(node, bound):
        if isinstance(node, ast.Name):
            if node.id not in roots | bound:
                raise ValueError(f"Unbound name: {node.id}")
        elif isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name) or node.func.id not in signatures:
                raise ValueError("Undocumented predicate")
            if node.keywords or len(node.args) != signatures[node.func.id]:
                raise ValueError("Predicate arity differs from documentation")
            if node.func.id in {"all", "any", "count"}:
                variable, collection, condition = node.args
                if not isinstance(variable, ast.Name) or variable.id in roots:
                    raise ValueError("Invalid quantified variable")
                visit(collection, bound)
                visit(condition, bound | {variable.id})
            else:
                for argument in node.args:
                    visit(argument, bound)
        elif isinstance(node, allowed):
            for child in ast.iter_child_nodes(node):
                visit(child, bound)
        else:
            raise ValueError(f"Unsupported notation: {type(node).__name__}")

    visit(tree, set())
    return tree.body


class TaskTx:
    def __init__(self, snapshot):
        self.snapshot = copy.deepcopy(snapshot)
        self.writes = 0
        self.corrupt = False

    def run(self, query, **params):
        if "SET t.precondition = t.precondition" in query:
            return SimpleNamespace(consume=lambda: None)
        if "SET t.precondition = $precondition" in query:
            nodes = [n for n in self.snapshot["nodes"] if n["key"] == params["key"]
                     and n["props"]["id"] == params["id"]]
            for node in nodes:
                node["props"].update({field: params[field] for field in FIELDS})
                self.writes += 1
            if self.corrupt:
                self.snapshot["edges"] = []
            return SimpleNamespace(single=lambda: {"count": len(nodes)})
        raise AssertionError(query)


class TaskConditionsTests(unittest.TestCase):
    def setUp(self):
        self.mapping = load_conditions()
        self.documentation = (Path(__file__).resolve().parents[1]
                              / "README_Task_Conditions.md").read_text()
        self.signatures = {
            name: len(parameters.split(","))
            for name, parameters in re.findall(
                r"^\| `([a-z_]+)\(([^)]*)\)` \|", self.documentation, re.MULTILINE)
        }
        self.before = {"nodes": [
            {"key": identifier, "labels": ["Task"],
             "props": {"id": identifier, "command": "KEEP", "custom": "preserved"}}
            for identifier in sorted(self.mapping)
        ] + [{"key": "coffee", "labels": ["Task"],
              "props": {"id": "T_K_TEST", "precondition": "original"}}],
            "edges": [{"key": "edge", "type": "OPERATIONALIZED_BY",
                       "props": {"custom": "preserved"}}]}

    def test_all_tasks_have_exactly_two_condition_fields(self):
        self.assertEqual(set(self.mapping), EXPECTED_IDS)
        self.assertEqual(len(self.mapping), 22)
        for props in self.mapping.values():
            self.assertEqual(set(props), set(FIELDS))
            self.assertTrue(all(value.strip() for value in props.values()))

    def test_all_expressions_have_valid_syntax_and_documented_predicates(self):
        points = set(re.findall(r"^\| `([A-Z_]+)` \|", self.documentation, re.MULTILINE))
        used_points = set()
        for identifier, props in self.mapping.items():
            for field, value in props.items():
                with self.subTest(task=identifier, field=field):
                    expression = parse_specification(value, self.signatures)
                    self.assertIsInstance(expression, ast.BoolOp)
                    self.assertIsInstance(expression.op, ast.And)
                    if field == "postcondition":
                        point = expression.values[0]
                        self.assertIsInstance(point, ast.Call)
                        self.assertEqual(point.func.id, "at")
                        used_points.add(point.args[0].value)
        self.assertEqual(used_points, points)

    def test_notation_check_rejects_prose_unknown_predicates_and_unbound_variables(self):
        for value in (
            "Robot battery greater than zero", "Robot.battery > 0 AND (",
            'unknown_check(Robot)', 'Robot.fsm == "IDLE" and Robot.battery > 0',
            'any(r, state.robots, r.battery > 0) AND r.battery < 100',
            'event_seen("TASK_COMPLETED")', 'exists(Robot); exists(Lift)',
        ):
            with self.subTest(value=value):
                with self.assertRaises((ValueError, SyntaxError, tokenize.TokenError)):
                    parse_specification(value, self.signatures)

    def test_completion_evidence_keeps_captured_ids_and_sampling_boundaries(self):
        required = {
            "T_R_DROP": ['state.tasks[before.Task.id].status == "COMPLETED"',
                         '"task_id": before.Task.id', '"robot_id": before.Robot.id',
                         'SIM.DROP_TICKS * before.station_slowdown'],
            "T_R_RECHARGE": ['charger_busy[before.runtime.charger_id] == null'],
            "T_LIFT_SERVE": ['lift_exit_seen(before.Robot.id, before.Lift.id, input.target_floor)'],
            "T_LIFT_GATE": ['door(Lift, before.Lift.floor)', 'SIM.LIFT_DOOR_TICKS'],
            "T_LIFT_RECOVER": ['Lift.until_tick == tick + before.Lift.fault_remaining',
                               'Lift.state == before.Lift.state'],
            "T_BELT_FEED": ['before.Conveyor.items_on_belt', 'before.state.robots'],
            "T_ZONE_MONITOR": ['before.state.robots', 'Zone.id IN blocked_zones'],
            "T_VLM_DETECT": ['before.context.snapshot.tick', 'input.frame_id', '"none"'],
            "T_FLEET_COLLECT_ENERGY": ['size(before.state.robots)',
                                       'count(e, output.robot_energy, e.id == r.id) == 1'],
        }
        for identifier, clauses in required.items():
            for clause in clauses:
                with self.subTest(task=identifier, clause=clause):
                    self.assertIn(clause, self.mapping[identifier]["postcondition"])
        for kind in ("PICK", "TRANSPORT", "REPLENISH", "RETURN"):
            post = self.mapping[f"T_ORDER_{kind}"]["postcondition"]
            self.assertIn('at("ORDER_CREATED")', post)
            self.assertIn('output.taskId NOT IN before.state.tasks', post)
            self.assertIn('.status == "WAITING"', post)
            self.assertIn(f'.type == "{kind}"', post)

    def test_alternative_branches_do_not_bypass_shared_guards(self):
        cases = [
            ("T_R_CHARGE", "precondition", "Robot.battery > 0"),
            ("T_R_AVOID", "postcondition", "safe_motion(Robot, before)"),
            ("T_SENSOR_REPORT", "postcondition", "finite(Sensor.value)"),
        ]
        for identifier, field, shared_guard in cases:
            expression = parse_specification(self.mapping[identifier][field], self.signatures)
            self.assertIsInstance(expression.op, ast.And)
            self.assertTrue(any(isinstance(v, ast.BoolOp) and isinstance(v.op, ast.Or)
                                for v in expression.values))
            guard = parse_specification(shared_guard, self.signatures)
            self.assertIn(ast.dump(guard), [ast.dump(v) for v in expression.values])

    def test_rejects_missing_empty_and_seed_splitter_unsafe_conditions(self):
        root = Path(__file__).resolve().parents[1]
        # Patch only the read of one real seed; all other files remain authoritative.
        original = Path.read_text
        text = (root / "waretwin_robot_kg.md").read_text()
        value = self.mapping["T_R_NAVIGATE"]["precondition"]
        for replacement in ("", "first;second", "first'broken"):
            broken = text.replace(value, replacement, 1)

            def read(path, *args, **kwargs):
                return broken if path.name == "waretwin_robot_kg.md" else original(path, *args, **kwargs)

            with patch.object(Path, "read_text", read):
                with self.assertRaises(ValueError):
                    load_conditions()

    def test_apply_preserves_other_data_and_reapply_is_noop(self):
        tx = TaskTx(self.before)
        with patch("migrate_task_conditions.graph_snapshot", lambda tx: copy.deepcopy(tx.snapshot)):
            self.assertEqual(migrate(tx, self.mapping), 22)
            self.assertEqual(migrate(tx, self.mapping), 0)
        self.assertEqual(tx.writes, 22)
        self.assertEqual(condition_plan(tx.snapshot, self.mapping), [])
        restored = copy.deepcopy(tx.snapshot)
        for node in restored["nodes"]:
            if node["props"]["id"] in self.mapping:
                for field in FIELDS:
                    node["props"].pop(field)
        self.assertEqual(restored, self.before)

    def test_missing_and_duplicate_ids_fail_before_condition_writes(self):
        missing = copy.deepcopy(self.before)
        missing["nodes"].pop(0)
        duplicate = copy.deepcopy(self.before)
        duplicate["nodes"].append(copy.deepcopy(duplicate["nodes"][0]))
        for snapshot in (missing, duplicate):
            tx = TaskTx(snapshot)
            with patch("migrate_task_conditions.graph_snapshot", lambda tx: copy.deepcopy(tx.snapshot)):
                with self.assertRaisesRegex(ValueError, "Expected one Task"):
                    migrate(tx, self.mapping)
            self.assertEqual(tx.writes, 0)

    def test_unplanned_graph_change_rejects_transaction(self):
        tx = TaskTx(self.before)
        tx.corrupt = True
        with patch("migrate_task_conditions.graph_snapshot", lambda tx: copy.deepcopy(tx.snapshot)):
            with self.assertRaisesRegex(ValueError, "Graph changed beyond"):
                migrate(tx, self.mapping)


if __name__ == "__main__":
    unittest.main()

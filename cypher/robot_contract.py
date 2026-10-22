"""Load the small Robot goal tree and project its conditions onto Neo4j."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "goal_model" / "waretwin_robot.json"

# Only properties written by the previous detailed Robot contract are migrated.
LEGACY_PROPERTIES = (
    "schemaVersion", "modelId", "expressionLanguage", "instanceKey", "contextSchemaJson",
    "parameterSchemaJson", "inputsJson", "evaluationPolicyJson", "goalType",
    "activationCondition", "evaluationMode", "requiredParameters", "refinementPolicy",
    "dependencyId", "consumerId", "providerId", "nodeLabel", "requiredCondition",
    "providerAgentId", "providerSelector", "bindingJson", "correlation",
    "satisfactionPolicy", "sourcePhase", "factor", "offset",
)


def walk_goals(goal):
    yield goal
    for child in goal.get("children", []):
        yield from walk_goals(child)


def dependencies(model):
    for goal in walk_goals(model["goal"]):
        if "depends_on" in goal:
            dep = goal["depends_on"]
            yield "Goal", goal["id"], dep["goal"], "ACHIEVED", {
                "actor": dep["actor"], "clause": dep["clause"],
                "when": dep.get("when", goal.get("when")),
                "binding": json.dumps(dep["binding"], ensure_ascii=False, sort_keys=True),
            }
    for dep in model.get("parameter_dependency", []):
        source, source_param = dep["from"].split(".")
        target, target_param = dep["to"].split(".")
        yield "Task", target, source, "PARAMETER", {
            "from": dep["from"], "to": dep["to"], "rule": dep["rule"],
            "when": dep.get("when"), "sourceParameter": source_param,
            "targetParameter": target_param,
        }


def validate_contract(model, cypher_dir=ROOT / "cypher"):
    if set(model) != {"systemId", "participants", "goal", "parameter_dependency"}:
        raise ValueError("Expected systemId, participants, goal and parameter_dependency")
    declarations = {label: set() for label in ("Goal", "Task")}
    actors = set()
    for path in cypher_dir.glob("waretwin_*_kg.md"):
        text = path.read_text(encoding="utf-8")
        for label, identifier in re.findall(r"MERGE\s*\(\w+:(Goal|Task)\s*\{id:\s*'([^']+)'", text):
            declarations[label].add(identifier)
        actors.update(re.findall(r"\b\w+\.name\s*=\s*'([^']+Agent)'", text))
    if not model["systemId"] or not set(model["participants"]) <= actors:
        raise ValueError("Unknown participants or missing systemId")
    seen = set()
    for goal in walk_goals(model["goal"]):
        if set(goal) - {"id", "description", "type", "clause", "when", "refinement", "children", "depends_on"}:
            raise ValueError(f"Unexpected goal fields: {goal['id']}")
        if goal["id"] in seen or goal["id"] not in declarations["Goal"]:
            raise ValueError(f"Duplicate or unknown goal: {goal['id']}")
        seen.add(goal["id"])
        if goal["type"] not in ("Achieve", "Maintain") or not goal["clause"] or not goal["description"]:
            raise ValueError(f"Invalid goal: {goal['id']}")
        if goal.get("children") and goal.get("refinement") not in ("AND", "OR"):
            raise ValueError(f"Missing refinement: {goal['id']}")
        for identifier in re.findall(r"\b(G_\w+)\.status", goal["clause"]):
            if identifier not in declarations["Goal"]:
                raise ValueError(f"Unknown goal reference: {identifier}")
        if "depends_on" in goal:
            dep = goal["depends_on"]
            if dep["actor"] not in model["participants"] or not isinstance(dep["binding"], dict):
                raise ValueError(f"Invalid dependency: {goal['id']}")
    expected = {g for g in declarations["Goal"] if g.startswith("G_R_")} | {"G_WT_TRANSPORT"}
    if seen != expected or model["goal"]["id"] != "G_WT_TRANSPORT":
        raise ValueError("Incomplete Robot goal coverage")
    seen_deps = set()
    for label, consumer, provider, kind, props in dependencies(model):
        if consumer not in declarations[label] or provider not in declarations[label]:
            raise ValueError(f"Unknown dependency endpoint: {consumer} -> {provider}")
        key = (consumer, provider, kind)
        if key in seen_deps:
            raise ValueError(f"Duplicate dependency: {key}")
        seen_deps.add(key)
        if kind == "PARAMETER" and not props["rule"].strip():
            raise ValueError("Missing parameter rule")


def load_contract():
    model = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    validate_contract(model)
    return model


def counts(model):
    return len(list(walk_goals(model["goal"]))), len(list(dependencies(model)))


def apply_contract(tx, model):
    """Migrate old properties and apply the simplified model in one transaction."""
    cleanup = dict.fromkeys(LEGACY_PROPERTIES)
    # Remove old metadata only from Robot-owned contracts, including obsolete edges.
    for entity, match in (("g", "(g:Goal)"), ("r", "()-[r:DEPENDS_ON]->()")):
        tx.run(f"MATCH {match} WHERE {entity}.modelId = 'waretwin.robot' "
               f"SET {entity} += $cleanup", cleanup=cleanup).consume()
    for goal in walk_goals(model["goal"]):
        props = {key: goal.get(key) for key in ("description", "type", "clause", "when", "refinement")}
        props["systemId"] = model["systemId"]
        if goal["id"] == model["goal"]["id"]:
            props["participants"] = model["participants"]
        result = tx.run("MATCH (g:Goal {id: $id}) SET g += $props RETURN count(g) AS count",
                        id=goal["id"], props={**cleanup, **props}).single()
        if result["count"] != 1:
            raise ValueError(f"Expected one goal: {goal['id']}")
        for child in goal.get("children", []):
            result = tx.run(
                "MATCH (:Goal {id: $parent})-[r:REFINES]->(:Goal {id: $child}) "
                "SET r.type = $refinement RETURN count(r) AS count",
                parent=goal["id"], child=child["id"], refinement=goal["refinement"],
            ).single()
            if result["count"] != 1:
                raise ValueError(f"Missing/duplicate refinement: {goal['id']} -> {child['id']}")
    for label, consumer, provider, kind, props in dependencies(model):
        result = tx.run(
            f"MATCH (s:{label} {{id: $consumer}})-[r:DEPENDS_ON]->(t:{label} {{id: $provider}}) "
            "WHERE r.type = $kind SET r += $props RETURN count(r) AS count",
            consumer=consumer, provider=provider, kind=kind,
            props={**cleanup, **props, "systemId": model["systemId"]},
        ).single()
        if result["count"] != 1:
            raise ValueError(f"Expected one dependency: {consumer} -> {provider}")


if __name__ == "__main__":
    goals, deps = counts(load_contract())
    print(f"Robot model valid: {goals} goals, {deps} dependencies")

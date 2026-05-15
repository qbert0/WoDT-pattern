from __future__ import annotations

from typing import Any, Dict, List

from smart_kettle_simulator.core.models import TaskPlan
from smart_kettle_simulator.neo4j_module.connection import Neo4jConnection
from smart_kettle_simulator.neo4j_module import queries


class KettleRepository:
    def __init__(self, connection: Neo4jConnection) -> None:
        self.connection = connection

    def get_goal_tree(self, goal_id: str) -> List[Dict[str, Any]]:
        with self.connection.session() as session:
            result = session.run(queries.GET_GOAL_TREE, goal_id=goal_id)
            return [record.data() for record in result]

    def get_goal_tasks(self, goal_id: str) -> List[TaskPlan]:
        with self.connection.session() as session:
            result = session.run(queries.GET_GOAL_TASKS, goal_id=goal_id)
            return [
                TaskPlan(
                    task_id=record["task_id"],
                    task_name=record["task_name"],
                    task_command=record["task_command"],
                    goal_id=record["goal_id"],
                    goal_name=record["goal_name"],
                    depends_on=[item for item in record["depends_on"] if item],
                )
                for record in result
            ]

    def can_execute_command(self, _thing_id: str, command: str) -> bool:
        task_command_map = {
            "turn_on": "TURN_ON",
            "turn_off": "TURN_OFF",
            "set_target_temperature": "SET_TEMP",
            "set_water_level": "SET_VOLUME",
        }
        task_command = task_command_map.get(command, command)
        with self.connection.session() as session:
            record = session.run(
                queries.CAN_EXECUTE_DT_COMMAND,
                task_command=task_command,
            ).single()
            return bool(record["can_execute"]) if record else False

    def build_execution_plan(self, goal_id: str) -> List[TaskPlan]:
        tasks = self.get_goal_tasks(goal_id)
        tasks_by_id = {task.task_id: task for task in tasks}
        remaining = {task.task_id: set(task.depends_on) for task in tasks}
        plan: List[TaskPlan] = []
        priority = {"SET_VOLUME": 1, "SET_TEMP": 2, "TURN_ON": 3, "TURN_OFF": 4}

        while remaining:
            ready = [
                task_id
                for task_id, deps in remaining.items()
                if not deps or deps.issubset({task.task_id for task in plan})
            ]
            if not ready:
                ready = list(remaining.keys())

            ready.sort(key=lambda task_id: priority.get(tasks_by_id[task_id].task_command, 99))
            next_task_id = ready[0]
            plan.append(tasks_by_id[next_task_id])
            remaining.pop(next_task_id)

        return plan

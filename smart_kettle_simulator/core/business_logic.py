from __future__ import annotations

from typing import Any, Dict, Iterable, List

from smart_kettle_simulator.core.exceptions import ValidationError
from smart_kettle_simulator.core.models import TaskPlan
from smart_kettle_simulator.ditto_client.payload_builder import DittoPayloadBuilder


class CoreService:
    """
    Chua logic nghiep vu trung tam:
    - Nhan state tu simulator
    - Format state thanh payload Ditto
    - Nhan command va dieu khien simulator
    - Kiem tra command voi Neo4j neu co repository
    """

    def __init__(self, thing_id: str, simulator=None, repository=None) -> None:
        self.thing_id = thing_id
        self.simulator = simulator
        self.repository = repository
        self.payload_builder = DittoPayloadBuilder()
        self.last_state: Dict[str, Any] = simulator.get_state() if simulator else {}
        self.task_to_device_command = {
            "TURN_ON": "turn_on",
            "TURN_OFF": "turn_off",
            "SET_TEMP": "set_target_temperature",
            "SET_VOLUME": "set_water_level",
        }

    def process_device_state(self, state: Dict[str, Any]) -> Dict[str, Any]:
        self.last_state = state
        return self.payload_builder.build_feature_payload(state)

    def process_simulator_state(self, state: Dict[str, Any]) -> Dict[str, Any]:
        return self.process_device_state(state)

    def handle_device_command(
        self, command: str, params: Dict[str, Any] | None = None
    ) -> Dict[str, Any]:
        return self._apply_command(command, params)

    def handle_simulator_command(
        self, command: str, params: Dict[str, Any] | None = None
    ) -> Dict[str, Any]:
        return self.handle_device_command(command, params)

    def handle_dt_command(
        self, command: str, params: Dict[str, Any] | None = None
    ) -> Dict[str, Any]:
        params = params or {}
        if self.repository and not self.repository.can_execute_command(self.thing_id, command):
            raise ValidationError(f"Command not supported by Neo4j: {command}")
        return self._apply_command(command, params)

    def build_command_sequence(
        self, task_plan: Iterable[TaskPlan], goal_params: Dict[str, Any] | None = None
    ) -> List[Dict[str, Any]]:
        goal_params = goal_params or {}
        commands: List[Dict[str, Any]] = []

        for task in task_plan:
            device_command = self.task_to_device_command.get(task.task_command)
            if not device_command:
                continue

            params: Dict[str, Any] = {}
            if task.task_command == "SET_TEMP":
                if "temperature" not in goal_params:
                    raise ValidationError("Goal requires `temperature`.")
                params["temperature"] = int(goal_params["temperature"])
            elif task.task_command == "SET_VOLUME":
                volume = goal_params.get("water_level", goal_params.get("volume"))
                if volume is None:
                    raise ValidationError("Goal requires `water_level` or `volume`.")
                params["water_level"] = int(volume)

            commands.append(
                {
                    "task_id": task.task_id,
                    "task_name": task.task_name,
                    "goal_id": task.goal_id,
                    "device_command": device_command,
                    "params": params,
                }
            )

        return commands

    def _apply_command(self, command: str, params: Dict[str, Any] | None = None) -> Dict[str, Any]:
        if self.simulator is None:
            raise ValidationError("Simulator is not attached to this core service.")
        state = self.simulator.apply_command(command, params or {})
        self.last_state = state
        return state

    def get_bootstrap_payload(self) -> Dict[str, Any]:
        return self.payload_builder.build_feature_payload(self.last_state)

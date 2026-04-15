from __future__ import annotations

from typing import Any, Dict

from smart_kettle_simulator.core.exceptions import ValidationError
from smart_kettle_simulator.ditto_client.payload_builder import DittoPayloadBuilder


class CoreService:
    """
    Chua logic nghiep vu trung tam:
    - Nhan state tu simulator
    - Format state thanh payload Ditto
    - Nhan command va dieu khien simulator
    - Kiem tra command voi Neo4j neu co repository
    """

    def __init__(self, thing_id: str, simulator, repository=None) -> None:
        self.thing_id = thing_id
        self.simulator = simulator
        self.repository = repository
        self.payload_builder = DittoPayloadBuilder()
        self.last_state: Dict[str, Any] = simulator.get_state()

    def process_simulator_state(self, state: Dict[str, Any]) -> Dict[str, Any]:
        self.last_state = state
        return self.payload_builder.build_feature_payload(state)

    def handle_command(self, command: str, params: Dict[str, Any] | None = None) -> Dict[str, Any]:
        params = params or {}
        if self.repository and not self.repository.can_execute_command(self.thing_id, command):
            raise ValidationError(f"Command not supported by Neo4j: {command}")
        state = self.simulator.apply_command(command, params)
        self.last_state = state
        return state

    def get_bootstrap_payload(self) -> Dict[str, Any]:
        return self.payload_builder.build_feature_payload(self.last_state)

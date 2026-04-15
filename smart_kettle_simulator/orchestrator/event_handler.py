from __future__ import annotations

from smart_kettle_simulator.core.models import SimulationEvent
from smart_kettle_simulator.neo4j_module.repository import KettleRepository
from smart_kettle_simulator.orchestrator.data_sync import DataSyncService


class EventHandler:
    def __init__(self, thing_id: str, repository: KettleRepository, data_sync: DataSyncService) -> None:
        self.thing_id = thing_id
        self.repository = repository
        self.data_sync = data_sync

    def handle_simulator_event(self, event: SimulationEvent) -> None:
        self.data_sync.sync_simulation_event(event)

    def validate_command(self, command: str) -> bool:
        return self.repository.can_execute_command(self.thing_id, command)

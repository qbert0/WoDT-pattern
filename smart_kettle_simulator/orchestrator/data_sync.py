from __future__ import annotations

from smart_kettle_simulator.core.models import SimulationEvent
from smart_kettle_simulator.ditto_client.thing_manager import ThingManager


class DataSyncService:
    def __init__(self, thing_manager: ThingManager) -> None:
        self.thing_manager = thing_manager

    def sync_simulation_event(self, event: SimulationEvent) -> None:
        if event.event_type != "state_update":
            return
        self.thing_manager.publish_state(event.payload)

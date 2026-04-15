from __future__ import annotations

from typing import Any, Dict


class DittoPayloadBuilder:
    def build_attributes_payload(self, thing_id: str, goal_root_id: str) -> Dict[str, Any]:
        return {
            "thingId": thing_id,
            "attributes": {
                "goalRootId": goal_root_id,
            },
        }

    def build_feature_payload(self, simulator_state: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "power": {
                "status": simulator_state.get("power_status", "off"),
            },
            "water": {
                "temperature": simulator_state.get("temperature", 25),
                "waterLevel": simulator_state.get("water_level", 0),
                "targetTemperature": simulator_state.get("target_temperature", 100),
            },
        }

from __future__ import annotations

from typing import Any, Dict


class DittoPayloadBuilder:
    def build_attributes_payload(self, thing_id: str, goal_root_id: str) -> Dict[str, Any]:
        return {
            "thingId": thing_id,
            "attributes": {
                "goalAgentId": goal_root_id,
            },
        }

    def build_feature_payload(self, simulator_state: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "power": {
                "status": simulator_state.get("power_status", "off"),
            },
            "grinder": {
                "status": simulator_state.get("grinder_status", "idle"),
                "grindComplete": simulator_state.get("grind_complete", False),
                "grindDurationSeconds": simulator_state.get("remaining_seconds", 0),
            },
            "beans": {
                "beanAmount": simulator_state.get("bean_amount", 0),
                "targetAmount": simulator_state.get("target_amount", 0),
            },
        }

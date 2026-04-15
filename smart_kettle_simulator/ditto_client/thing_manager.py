from __future__ import annotations

from typing import Any, Dict

from smart_kettle_simulator.ditto_client.ditto_api import DittoAPI
from smart_kettle_simulator.ditto_client.payload_builder import DittoPayloadBuilder


class ThingManager:
    def __init__(self, thing_id: str, api: DittoAPI, payload_builder: DittoPayloadBuilder | None = None) -> None:
        self.thing_id = thing_id
        self.api = api
        self.payload_builder = payload_builder or DittoPayloadBuilder()

    def register_thing(self, simulator_state: Dict[str, Any]) -> Dict[str, Any]:
        payload = self.payload_builder.build_thing_payload(self.thing_id, simulator_state)
        return self.api.upsert_thing(self.thing_id, payload)

    def publish_state(self, simulator_state: Dict[str, Any]) -> Dict[str, Any]:
        features_payload = self.payload_builder.build_feature_payload(simulator_state)
        return self.api.patch_features(self.thing_id, features_payload)

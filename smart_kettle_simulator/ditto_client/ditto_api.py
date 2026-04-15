from __future__ import annotations

from typing import Any, Dict

from smart_kettle_simulator.core.exceptions import DittoClientError


class DittoAPI:
    def __init__(self, base_url: str, username: str, password: str) -> None:
        import requests

        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.auth = (username, password)
        self.session.headers.update({"Content-Type": "application/json"})

    def upsert_thing(self, thing_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        response = self.session.put(f"{self.base_url}/things/{thing_id}", json=payload, timeout=10)
        if response.status_code >= 400:
            raise DittoClientError(f"Ditto upsert failed: {response.status_code} {response.text}")
        return response.json() if response.content else {}

    def patch_features(self, thing_id: str, features_payload: Dict[str, Any]) -> Dict[str, Any]:
        response = self.session.put(
            f"{self.base_url}/things/{thing_id}/features",
            json=features_payload,
            timeout=10,
        )
        if response.status_code >= 400:
            raise DittoClientError(f"Ditto feature update failed: {response.status_code} {response.text}")
        return response.json() if response.content else {}

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    def load_dotenv(*_args, **_kwargs) -> bool:
        return False


load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@dataclass(frozen=True)
class Settings:
    thing_id: str = os.getenv("THING_ID", "smart-home:kettle-01")
    simulation_interval: float = float(os.getenv("SIMULATION_INTERVAL", "2.0"))
    ditto_mqtt_host: str = os.getenv("DITTO_MQTT_HOST", "100.104.220.45")
    ditto_mqtt_port: int = int(os.getenv("DITTO_MQTT_PORT", "1883"))
    ditto_mqtt_username: str = os.getenv("DITTO_MQTT_USERNAME", "")
    ditto_mqtt_password: str = os.getenv("DITTO_MQTT_PASSWORD", "")
    neo4j_uri: str = os.getenv("NEO4J_URI", "bolt://100.104.220.45:7687")
    neo4j_user: str = os.getenv("NEO4J_USER", "neo4j")
    neo4j_password: str = os.getenv("NEO4J_PASSWORD", "password123")


settings = Settings()

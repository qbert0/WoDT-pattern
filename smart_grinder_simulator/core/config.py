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
    thing_id: str = os.getenv("THING_ID", "smart-home:grinder-01")
    goal_root_id: str = os.getenv("GOAL_ROOT_ID", "G_GRINDER_ROOT")
    simulation_interval: float = float(os.getenv("SIMULATION_INTERVAL", "2.0"))
    grind_duration_seconds: int = int(os.getenv("GRIND_DURATION_SECONDS", "60"))
    mqtt_host: str = os.getenv("MQTT_HOST", os.getenv("DITTO_MQTT_HOST", "100.104.220.45"))
    mqtt_port: int = int(os.getenv("MQTT_PORT", os.getenv("DITTO_MQTT_PORT", "1883")))
    mqtt_username: str = os.getenv("MQTT_USERNAME", os.getenv("DITTO_MQTT_USERNAME", ""))
    mqtt_password: str = os.getenv("MQTT_PASSWORD", os.getenv("DITTO_MQTT_PASSWORD", ""))
    ditto_mqtt_host: str = os.getenv("DITTO_MQTT_HOST", os.getenv("MQTT_HOST", "100.104.220.45"))
    ditto_mqtt_port: int = int(os.getenv("DITTO_MQTT_PORT", os.getenv("MQTT_PORT", "1883")))
    ditto_mqtt_username: str = os.getenv("DITTO_MQTT_USERNAME", os.getenv("MQTT_USERNAME", ""))
    ditto_mqtt_password: str = os.getenv("DITTO_MQTT_PASSWORD", os.getenv("MQTT_PASSWORD", ""))
    neo4j_uri: str = os.getenv("NEO4J_URI", "bolt://100.104.220.45:7687")
    neo4j_user: str = os.getenv("NEO4J_USER", "neo4j")
    neo4j_password: str = os.getenv("NEO4J_PASSWORD", "password123")


settings = Settings()

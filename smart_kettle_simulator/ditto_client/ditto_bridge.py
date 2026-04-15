from __future__ import annotations

import json
import time
from typing import Any, Callable, Dict, Optional


class DittoTwinBridge:
    """
    Bridge between the internal digital twin and Eclipse Ditto over MQTT.
    """

    def __init__(
        self,
        broker_host: str,
        broker_port: int,
        thing_id: str,
        username: str = "",
        password: str = "",
        on_ditto_command: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> None:
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.thing_id = thing_id
        self.username = username
        self.password = password
        self.on_ditto_command = on_ditto_command
        self.client = None
        self.command_topic = f"ditto/things/{self.thing_id}/inbox/messages/+"
        self._last_feature_values: Dict[str, Dict[str, Any]] = {}

    def connect(self) -> bool:
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            print("Missing dependency: paho-mqtt")
            return False

        self.client = mqtt.Client(client_id=f"ditto_twin_bridge_{self.thing_id}")
        if self.username:
            self.client.username_pw_set(self.username, self.password)
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.connect(self.broker_host, self.broker_port, 60)
        self.client.loop_start()
        time.sleep(1)
        return True

    def _on_connect(self, client, _userdata, _flags, rc):
        if rc != 0:
            print(f"[DittoBridge] Connect failed: {rc}")
            return
        client.subscribe(self.command_topic)
        print(f"[DittoBridge] Listening on {self.command_topic}")

    def _on_message(self, client, _userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            commands = payload.get("value", {})
            reply_topic = f"{msg.topic}/response"

            if not isinstance(commands, dict):
                return

            for command, params in commands.items():
                if self.on_ditto_command:
                    self.on_ditto_command(command, params or {})
                response = {"status": 200, "command": command}
                client.publish(reply_topic, json.dumps(response), qos=0)
        except Exception as exc:
            client.publish(
                f"{msg.topic}/response",
                json.dumps({"status": 500, "message": str(exc)}),
                qos=0,
            )

    def publish_features(self, features_payload: Dict[str, Any]) -> None:
        if not self.client:
            return

        for feature_name, properties in features_payload.items():
            feature_cache = self._last_feature_values.setdefault(feature_name, {})
            for property_name, value in properties.items():
                if feature_cache.get(property_name) == value:
                    continue

                topic = (
                    f"ditto/things/{self.thing_id}/features/"
                    f"{feature_name}/properties/{property_name}"
                )
                self.client.publish(topic, json.dumps({"value": value}), qos=1)
                feature_cache[property_name] = value
                time.sleep(0.05)

    def publish_attributes(self, attributes_payload: Dict[str, Any]) -> None:
        if not self.client:
            return

        topic = f"ditto/things/{self.thing_id}/attributes"
        self.client.publish(topic, json.dumps({"value": attributes_payload}), qos=1)
        time.sleep(0.05)

    def disconnect(self) -> None:
        if not self.client:
            return
        self.client.loop_stop()
        self.client.disconnect()

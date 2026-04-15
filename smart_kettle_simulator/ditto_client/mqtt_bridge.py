from __future__ import annotations

import json
import time
from typing import Any, Callable, Dict, Optional


class DittoMQTTClient:
    """
    Gui telemetry len Ditto qua MQTT va nhan command tu Ditto gui ve.
    """

    def __init__(
        self,
        broker_host: str,
        broker_port: int,
        thing_id: str,
        username: str = "",
        password: str = "",
        on_command: Optional[Callable[[str, Dict[str, Any]], Dict[str, Any] | None]] = None,
    ) -> None:
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.thing_id = thing_id
        self.username = username
        self.password = password
        self.on_command = on_command
        self.client = None

    def connect(self) -> bool:
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            print("Missing dependency: paho-mqtt")
            return False

        self.client = mqtt.Client(client_id=f"ditto_bridge_{self.thing_id}")
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
            print(f"[DittoMQTT] Connect failed: {rc}")
            return
        command_topic = f"ditto/things/{self.thing_id}/inbox/messages/+"
        client.subscribe(command_topic)
        print(f"[DittoMQTT] Listening on {command_topic}")

    def _on_message(self, client, _userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            commands = payload.get("value", {})
            reply_topic = f"{msg.topic}/response"

            if not isinstance(commands, dict):
                return

            for command, params in commands.items():
                result = None
                if self.on_command:
                    result = self.on_command(command, params or {})
                response = {"status": 200, "command": command, "result": result or {}}
                client.publish(reply_topic, json.dumps(response), qos=0)
        except Exception as exc:
            error_response = {"status": 500, "message": str(exc)}
            client.publish(f"{msg.topic}/response", json.dumps(error_response), qos=0)

    def publish_state(self, ditto_payload: Dict[str, Any]) -> None:
        if not self.client:
            return
        for feature_name, properties in ditto_payload.items():
            topic = f"ditto/things/{self.thing_id}/features/{feature_name}/properties"
            self.client.publish(topic, json.dumps({"value": properties}), qos=1)
            time.sleep(0.05)

    def disconnect(self) -> None:
        if not self.client:
            return
        self.client.loop_stop()
        self.client.disconnect()

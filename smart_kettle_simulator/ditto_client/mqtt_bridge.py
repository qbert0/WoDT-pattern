from __future__ import annotations

import json
import time
from typing import Any, Callable, Dict, Optional


class KettleMQTTBridge:
    """
    Cau noi MQTT chung giua simulator va digital twin.
    """

    def __init__(
        self,
        broker_host: str,
        broker_port: int,
        thing_id: str,
        username: str = "",
        password: str = "",
        on_device_command: Optional[Callable[[str, Dict[str, Any]], Dict[str, Any] | None]] = None,
        on_state: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_response: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.thing_id = thing_id
        self.username = username
        self.password = password
        self.on_device_command = on_device_command
        self.on_state = on_state
        self.on_response = on_response
        self.client = None
        self.state_topic = f"kettle/{self.thing_id}/state"
        self.command_topic = f"kettle/{self.thing_id}/commands"
        self.response_topic = f"kettle/{self.thing_id}/responses"
        self.mode: str | None = None

    def connect_device(self) -> bool:
        self.mode = "device"
        return self._connect()

    def connect_twin(self) -> bool:
        self.mode = "twin"
        return self._connect()

    def _connect(self) -> bool:
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            print("Missing dependency: paho-mqtt")
            return False

        self.client = mqtt.Client(client_id=f"kettle_bridge_{self.mode}_{self.thing_id}")
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
            print(f"[MQTTBridge] Connect failed: {rc}")
            return

        if self.mode == "device":
            client.subscribe(self.command_topic)
            print(f"[MQTTBridge] Device listening on {self.command_topic}")
        elif self.mode == "twin":
            client.subscribe(self.state_topic)
            client.subscribe(self.response_topic)
            print(f"[MQTTBridge] Twin listening on {self.state_topic} and {self.response_topic}")

    def _on_message(self, client, _userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            if self.mode == "device" and msg.topic == self.command_topic:
                command = payload.get("command")
                params = payload.get("params", {})
                result = None
                if self.on_device_command and command:
                    result = self.on_device_command(command, params)
                self.publish_response(
                    {
                        "status": 200,
                        "command": command,
                        "result": result or {},
                    }
                )
            elif self.mode == "twin" and msg.topic == self.state_topic:
                if self.on_state:
                    self.on_state(payload)
            elif self.mode == "twin" and msg.topic == self.response_topic:
                if self.on_response:
                    self.on_response(payload)
        except Exception as exc:
            self.publish_response({"status": 500, "message": str(exc)})

    def publish_state(self, state_payload: Dict[str, Any]) -> None:
        if not self.client:
            return
        self.client.publish(self.state_topic, json.dumps(state_payload), qos=1)
        time.sleep(0.05)

    def publish_command(self, command: str, params: Dict[str, Any] | None = None) -> None:
        if not self.client:
            return
        payload = {"command": command, "params": params or {}}
        self.client.publish(self.command_topic, json.dumps(payload), qos=1)
        time.sleep(0.05)

    def publish_response(self, response_payload: Dict[str, Any]) -> None:
        if not self.client:
            return
        self.client.publish(self.response_topic, json.dumps(response_payload), qos=1)
        time.sleep(0.05)

    def disconnect(self) -> None:
        if not self.client:
            return
        self.client.loop_stop()
        self.client.disconnect()


DittoMQTTClient = KettleMQTTBridge

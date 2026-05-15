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
        
        # Parse namespace and name from thing_id (e.g. smart-home:kettle-01)
        if ":" in self.thing_id:
            ns, name = self.thing_id.split(":", 1)
        else:
            ns, name = "default", self.thing_id
            
        self.ditto_topic_prefix = f"{ns}/{name}/things"
        self.command_topic = f"{self.ditto_topic_prefix}/live/messages/+"
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
        subject = msg.topic.split("/")[-1]
        reply_topic = msg.topic

        try:
            payload = json.loads(msg.payload.decode())
            commands = payload.get("value", {})
            headers = payload.get("headers", {})

            result_value: Dict[str, Any] = {"command": subject, "accepted": True}
            if self.on_ditto_command:
                result = self.on_ditto_command(subject, commands or {})
                if isinstance(result, dict):
                    result_value.update(result)

            response_headers = {"content-type": "application/json"}
            if "correlation-id" in headers:
                response_headers["correlation-id"] = headers["correlation-id"]

            response_payload = {
                "topic": f"{self.ditto_topic_prefix}/live/messages/{subject}",
                "headers": response_headers,
                "path": f"/outbox/messages/{subject}",
                "status": 200,
                "value": result_value,
            }
            client.publish(reply_topic, json.dumps(response_payload), qos=0)

        except Exception as exc:
            response_payload = {
                "topic": f"{self.ditto_topic_prefix}/live/messages/{subject}",
                "headers": {"content-type": "application/json"},
                # ✅ Bug 2 fix: outbox ở đây cũng vậy
                "path": f"/outbox/messages/{subject}",
                "status": 500,
                "value": {"error": str(exc)},
            }
            client.publish(reply_topic, json.dumps(response_payload), qos=0)

    def publish_features(self, features_payload: Dict[str, Any]) -> None:
        if not self.client:
            return

        for feature_name, properties in features_payload.items():
            feature_cache = self._last_feature_values.setdefault(feature_name, {})
            for property_name, value in properties.items():
                if feature_cache.get(property_name) == value:
                    continue

                topic = f"{self.ditto_topic_prefix}/twin/commands/modify"
                path = f"/features/{feature_name}/properties/{property_name}"
                payload = {
                    "topic": topic,
                    "headers": {"content-type": "application/json"},
                    "path": path,
                    "value": value
                }
                self.client.publish(topic, json.dumps(payload), qos=1)
                feature_cache[property_name] = value
                time.sleep(0.05)

    def publish_attributes(self, attributes_payload: Dict[str, Any]) -> None:
        if not self.client:
            return

        topic = f"{self.ditto_topic_prefix}/twin/commands/modify"
        payload = {
            "topic": topic,
            "headers": {"content-type": "application/json"},
            "path": "/attributes",
            "value": attributes_payload
        }
        self.client.publish(topic, json.dumps(payload), qos=1)
        time.sleep(0.05)

    def disconnect(self) -> None:
        if not self.client:
            return
        self.client.loop_stop()
        self.client.disconnect()

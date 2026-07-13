from __future__ import annotations

import json
import time
from typing import Any, Callable, Dict, Optional


class DittoTwinBridge:
    """Bridge between the grinder digital twin and Eclipse Ditto over MQTT."""

    def __init__(
        self,
        broker_host: str,
        broker_port: int,
        thing_id: str,
        username: str = "",
        password: str = "",
        on_ditto_command: Optional[
            Callable[[str, Dict[str, Any]], Dict[str, Any] | None]
        ] = None,
    ) -> None:
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.thing_id = thing_id
        self.username = username
        self.password = password
        self.on_ditto_command = on_ditto_command
        self.client = None

        if ":" in self.thing_id:
            namespace, name = self.thing_id.split(":", 1)
        else:
            namespace, name = "default", self.thing_id

        self.ditto_topic_prefix = f"{namespace}/{name}/things"
        self.command_topic = f"{self.ditto_topic_prefix}/live/messages/+"
        self._last_feature_values: Dict[str, Dict[str, Any]] = {}

    def connect(self) -> bool:
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            print("Missing dependency: paho-mqtt")
            return False

        try:
            self.client = mqtt.Client(client_id=f"ditto_twin_bridge_{self.thing_id}")
            if self.username:
                self.client.username_pw_set(self.username, self.password)
            self.client.on_connect = self._on_connect
            self.client.on_message = self._on_message
            self.client.connect(self.broker_host, self.broker_port, 60)
            self.client.loop_start()
            time.sleep(1)
            return True
        except Exception as exc:
            self.client = None
            print(
                f"[DittoBridge] Cannot connect to "
                f"{self.broker_host}:{self.broker_port}: {exc}"
            )
            return False

    def _on_connect(self, client, _userdata, _flags, rc):
        if rc != 0:
            print(f"[DittoBridge] Connect failed: {rc}")
            return
        client.subscribe(self.command_topic)
        print(f"[DittoBridge] Listening on {self.command_topic}")

    def _on_message(self, client, _userdata, msg):
        subject = msg.topic.split("/")[-1]
        reply_topic = f"{msg.topic}/response"
        request_payload: Any = {}

        try:
            request_payload = json.loads(msg.payload.decode())
            if not isinstance(request_payload, dict):
                raise ValueError("Ditto Protocol payload must be a JSON object")

            params = request_payload.get("value", {})
            if params is None:
                params = {}
            if not isinstance(params, dict):
                raise ValueError("Ditto message value must be a JSON object")

            headers = request_payload.get("headers", {})
            if not isinstance(headers, dict):
                raise ValueError("Ditto Protocol headers must be a JSON object")

            request_topic = request_payload.get("topic")
            if not isinstance(request_topic, str) or not request_topic:
                raise ValueError("Ditto Protocol payload is missing topic")

            response_path = self._response_path(request_payload.get("path"))

            result_value: Dict[str, Any] = {"command": subject, "accepted": True}
            if self.on_ditto_command:
                result = self.on_ditto_command(subject, params)
                if isinstance(result, dict):
                    result_value.update(result)

            response_headers = {"content-type": "application/json"}
            if "correlation-id" in headers:
                response_headers["correlation-id"] = headers["correlation-id"]

            response_payload = {
                "topic": request_topic,
                "headers": response_headers,
                "path": response_path,
                "status": 200,
                "value": result_value,
            }
            client.publish(reply_topic, json.dumps(response_payload), qos=0)
        except Exception as exc:
            print(f"[DittoBridge] Invalid message on {msg.topic}: {exc}")
            request_headers = (
                request_payload.get("headers", {})
                if isinstance(request_payload, dict)
                else {}
            )
            response_headers = {"content-type": "application/json"}
            if isinstance(request_headers, dict) and "correlation-id" in request_headers:
                response_headers["correlation-id"] = request_headers["correlation-id"]

            request_topic = (
                request_payload.get("topic")
                if isinstance(request_payload, dict)
                else None
            )
            if not isinstance(request_topic, str) or not request_topic:
                request_topic = f"{self.ditto_topic_prefix}/live/messages/{subject}"

            try:
                response_path = self._response_path(
                    request_payload.get("path")
                    if isinstance(request_payload, dict)
                    else None
                )
            except ValueError:
                response_path = f"/outbox/messages/{subject}"

            response_payload = {
                "topic": request_topic,
                "headers": response_headers,
                "path": response_path,
                "status": 500,
                "value": {"error": str(exc)},
            }
            client.publish(reply_topic, json.dumps(response_payload), qos=0)

    @staticmethod
    def _response_path(request_path: Any) -> str:
        if not isinstance(request_path, str) or "/inbox/messages/" not in request_path:
            raise ValueError("Ditto message path must contain /inbox/messages/")
        return request_path.replace("/inbox/messages/", "/outbox/messages/", 1)

    def publish_features(self, features_payload: Dict[str, Any]) -> None:
        if not self.client:
            return

        for feature_name, properties in features_payload.items():
            feature_cache = self._last_feature_values.setdefault(feature_name, {})
            for property_name, value in properties.items():
                if feature_cache.get(property_name) == value:
                    continue

                topic = f"{self.ditto_topic_prefix}/twin/commands/modify"
                payload = {
                    "topic": topic,
                    "headers": {"content-type": "application/json"},
                    "path": f"/features/{feature_name}/properties/{property_name}",
                    "value": value,
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
            "value": attributes_payload,
        }
        self.client.publish(topic, json.dumps(payload), qos=1)
        time.sleep(0.05)

    def disconnect(self) -> None:
        if not self.client:
            return
        self.client.loop_stop()
        self.client.disconnect()

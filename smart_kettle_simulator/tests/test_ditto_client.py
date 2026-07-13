import json
from pathlib import Path

import paho.mqtt.client as mqtt

from smart_kettle_simulator.ditto_client.ditto_bridge import DittoTwinBridge
from smart_kettle_simulator.ditto_client.payload_builder import DittoPayloadBuilder


ROOT = Path(__file__).resolve().parents[2]


class FakeMQTTClient:
    def __init__(self):
        self.subscriptions = []
        self.publications = []

    def subscribe(self, topic):
        self.subscriptions.append(topic)

    def publish(self, topic, payload, qos):
        self.publications.append((topic, json.loads(payload), qos))


class FakeMQTTMessage:
    def __init__(self, topic, payload):
        self.topic = topic
        self.payload = json.dumps(payload).encode()


def build_bridge(on_command=None):
    return DittoTwinBridge(
        broker_host="localhost",
        broker_port=1883,
        thing_id="smart-home:kettle-01",
        on_ditto_command=on_command,
    )


def test_build_feature_payload_contains_water_and_power():
    payload = DittoPayloadBuilder().build_feature_payload({"temperature": 90, "power_status": "on"})
    assert "water" in payload
    assert "power" in payload


def test_bridge_subscribes_only_to_live_message_requests():
    bridge = build_bridge()
    client = FakeMQTTClient()

    bridge._on_connect(client, None, None, 0)

    assert client.subscriptions == [
        "smart-home/kettle-01/things/live/messages/+"
    ]
    assert mqtt.topic_matches_sub(
        bridge.command_topic,
        "smart-home/kettle-01/things/live/messages/turn_on",
    )
    assert not mqtt.topic_matches_sub(
        bridge.command_topic,
        "smart-home/kettle-01/things/live/messages/turn_on/response",
    )


def test_bridge_forwards_command_and_returns_thing_response():
    forwarded = []
    bridge = build_bridge(lambda command, params: forwarded.append((command, params)))
    client = FakeMQTTClient()
    request_topic = "smart-home/kettle-01/things/live/messages/turn_on"
    message = FakeMQTTMessage(
        request_topic,
        {
            "topic": request_topic,
            "headers": {"correlation-id": "thing-command-1"},
            "path": "/inbox/messages/turn_on",
            "value": {},
        },
    )

    bridge._on_message(client, None, message)

    assert forwarded == [("turn_on", {})]
    response_topic, response, qos = client.publications[0]
    assert response_topic == f"{request_topic}/response"
    assert qos == 0
    assert response["topic"] == request_topic
    assert response["path"] == "/outbox/messages/turn_on"
    assert response["headers"]["correlation-id"] == "thing-command-1"
    assert response["status"] == 200
    assert response["value"] == {"command": "turn_on", "accepted": True}


def test_bridge_preserves_feature_path_and_forwards_params():
    forwarded = []
    bridge = build_bridge(lambda command, params: forwarded.append((command, params)))
    client = FakeMQTTClient()
    request_topic = (
        "smart-home/kettle-01/things/live/messages/set_target_temperature"
    )
    message = FakeMQTTMessage(
        request_topic,
        {
            "topic": request_topic,
            "headers": {"correlation-id": "feature-command-1"},
            "path": (
                "/features/water/inbox/messages/set_target_temperature"
            ),
            "value": {"temperature": 95},
        },
    )

    bridge._on_message(client, None, message)

    assert forwarded == [
        ("set_target_temperature", {"temperature": 95})
    ]
    _, response, _ = client.publications[0]
    assert response["path"] == (
        "/features/water/outbox/messages/set_target_temperature"
    )
    assert response["headers"]["correlation-id"] == "feature-command-1"
    assert response["status"] == 200


def test_bridge_returns_500_and_request_metadata_when_forwarding_fails():
    def fail_forward(_command, _params):
        raise RuntimeError("simulator unavailable")

    bridge = build_bridge(fail_forward)
    client = FakeMQTTClient()
    request_topic = "smart-home/kettle-01/things/live/messages/turn_off"
    message = FakeMQTTMessage(
        request_topic,
        {
            "topic": request_topic,
            "headers": {"correlation-id": "failed-command-1"},
            "path": "/features/power/inbox/messages/turn_off",
            "value": {},
        },
    )

    bridge._on_message(client, None, message)

    response_topic, response, qos = client.publications[0]
    assert response_topic == f"{request_topic}/response"
    assert qos == 0
    assert response["topic"] == request_topic
    assert response["path"] == "/features/power/outbox/messages/turn_off"
    assert response["headers"]["correlation-id"] == "failed-command-1"
    assert response["status"] == 500
    assert response["value"] == {"error": "simulator unavailable"}


def test_kettle_connection_uses_separate_request_and_response_topics():
    connection_path = ROOT / "mqtt_project" / "ditto_connection.json"
    connection = json.loads(connection_path.read_text(encoding="utf-8"))

    source = connection["sources"][0]
    assert source["addresses"] == [
        "smart-home/kettle-01/things/twin/commands/modify",
        "smart-home/kettle-01/things/live/messages/+/response",
    ]
    assert source["consumerCount"] == 1
    assert source["headerMapping"] == {}
    assert "smart-home/kettle-01/things/live/messages/#" not in source["addresses"]
    assert "smart-home/kettle-01/things/twin/messages/#" not in source["addresses"]

    target = connection["targets"][0]
    assert target["address"] == (
        "smart-home/{{ thing:name }}/things/live/messages/{{ topic:subject }}"
    )
    assert target["topics"] == ["_/_/things/live/messages"]
    assert target["headerMapping"] == {}

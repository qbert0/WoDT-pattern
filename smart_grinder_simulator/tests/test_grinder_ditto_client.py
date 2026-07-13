import json

import paho.mqtt.client as mqtt
import pytest

from smart_grinder_simulator.ditto_client.ditto_bridge import DittoTwinBridge


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
        thing_id="smart-home:grinder-01",
        on_ditto_command=on_command,
    )


def test_bridge_subscribes_only_to_live_message_requests():
    bridge = build_bridge()
    client = FakeMQTTClient()

    bridge._on_connect(client, None, None, 0)

    assert client.subscriptions == [
        "smart-home/grinder-01/things/live/messages/+"
    ]
    assert mqtt.topic_matches_sub(
        bridge.command_topic,
        "smart-home/grinder-01/things/live/messages/grind",
    )
    assert not mqtt.topic_matches_sub(
        bridge.command_topic,
        "smart-home/grinder-01/things/live/messages/grind/response",
    )


@pytest.mark.parametrize(
    ("subject", "params"),
    [
        ("set_bean_amount", {"amount": 30}),
        ("grind", {}),
        ("stop", {}),
    ],
)
def test_bridge_forwards_subject_and_value_as_command(subject, params):
    forwarded = []
    bridge = build_bridge(
        lambda command, command_params: forwarded.append((command, command_params))
    )
    client = FakeMQTTClient()
    request_topic = f"smart-home/grinder-01/things/live/messages/{subject}"
    message = FakeMQTTMessage(
        request_topic,
        {
            "topic": request_topic,
            "headers": {"correlation-id": f"{subject}-1"},
            "path": f"/inbox/messages/{subject}",
            "value": params,
        },
    )

    bridge._on_message(client, None, message)

    assert forwarded == [(subject, params)]
    response_topic, response, qos = client.publications[0]
    assert response_topic == f"{request_topic}/response"
    assert qos == 0
    assert response["topic"] == request_topic
    assert response["path"] == f"/outbox/messages/{subject}"
    assert response["headers"]["correlation-id"] == f"{subject}-1"
    assert response["status"] == 200
    assert response["value"] == {"command": subject, "accepted": True}
    assert len(client.publications) == 1


def test_bridge_preserves_feature_path():
    forwarded = []
    bridge = build_bridge(
        lambda command, params: forwarded.append((command, params))
    )
    client = FakeMQTTClient()
    request_topic = (
        "smart-home/grinder-01/things/live/messages/set_bean_amount"
    )
    message = FakeMQTTMessage(
        request_topic,
        {
            "topic": request_topic,
            "headers": {"correlation-id": "feature-command-1"},
            "path": "/features/beans/inbox/messages/set_bean_amount",
            "value": {"amount": 40},
        },
    )

    bridge._on_message(client, None, message)

    assert forwarded == [("set_bean_amount", {"amount": 40})]
    _, response, _ = client.publications[0]
    assert response["path"] == (
        "/features/beans/outbox/messages/set_bean_amount"
    )
    assert response["headers"]["correlation-id"] == "feature-command-1"


def test_bridge_returns_500_and_request_metadata_when_forwarding_fails():
    def fail_forward(_command, _params):
        raise RuntimeError("simulator unavailable")

    bridge = build_bridge(fail_forward)
    client = FakeMQTTClient()
    request_topic = "smart-home/grinder-01/things/live/messages/grind"
    message = FakeMQTTMessage(
        request_topic,
        {
            "topic": request_topic,
            "headers": {"correlation-id": "failed-command-1"},
            "path": "/features/grinder/inbox/messages/grind",
            "value": {},
        },
    )

    bridge._on_message(client, None, message)

    response_topic, response, qos = client.publications[0]
    assert response_topic == f"{request_topic}/response"
    assert qos == 0
    assert response["topic"] == request_topic
    assert response["path"] == "/features/grinder/outbox/messages/grind"
    assert response["headers"]["correlation-id"] == "failed-command-1"
    assert response["status"] == 500
    assert response["value"] == {"error": "simulator unavailable"}


def test_bridge_publishes_ditto_protocol_feature_updates_and_caches_values():
    bridge = build_bridge()
    client = FakeMQTTClient()
    bridge.client = client
    features = {
        "power": {"status": "on"},
        "beans": {"beanAmount": 30},
    }

    bridge.publish_features(features)
    bridge.publish_features(features)

    assert len(client.publications) == 2
    topic, power_payload, qos = client.publications[0]
    assert topic == "smart-home/grinder-01/things/twin/commands/modify"
    assert qos == 1
    assert power_payload == {
        "topic": topic,
        "headers": {"content-type": "application/json"},
        "path": "/features/power/properties/status",
        "value": "on",
    }
    _, beans_payload, _ = client.publications[1]
    assert beans_payload["path"] == "/features/beans/properties/beanAmount"
    assert beans_payload["value"] == 30


def test_bridge_publishes_attributes_as_ditto_protocol_message():
    bridge = build_bridge()
    client = FakeMQTTClient()
    bridge.client = client

    bridge.publish_attributes({"goalRootId": "G_GRINDER_ROOT"})

    topic, payload, qos = client.publications[0]
    assert topic == "smart-home/grinder-01/things/twin/commands/modify"
    assert qos == 1
    assert payload == {
        "topic": topic,
        "headers": {"content-type": "application/json"},
        "path": "/attributes",
        "value": {"goalRootId": "G_GRINDER_ROOT"},
    }

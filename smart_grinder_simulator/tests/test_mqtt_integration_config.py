import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class MQTTIntegrationConfigTest(unittest.TestCase):
    def test_connection_template_is_valid_after_substitution(self):
        template = (
            ROOT
            / "ditto-ambassador"
            / "examples"
            / "grinder-mqtt-connection.json.template"
        ).read_text(encoding="utf-8")
        substitutions = {
            "${MQTT_HOST}": "34.143.166.45",
            "${MQTT_PORT}": "1883",
            "${MQTT_USERNAME}": "test-user",
            "${MQTT_PASSWORD}": "test-password",
        }
        for key, value in substitutions.items():
            template = template.replace(key, value)

        connection = json.loads(template)

        self.assertEqual(
            connection["uri"],
            "tcp://test-user:test-password@34.143.166.45:1883",
        )
        source = connection["sources"][0]
        self.assertEqual(
            source["addresses"],
            [
                "smart-home/grinder-01/things/twin/commands/modify",
                "smart-home/grinder-01/things/live/messages/+/response",
            ],
        )
        self.assertEqual(source["consumerCount"], 1)
        self.assertEqual(source["qos"], 0)
        self.assertEqual(source["headerMapping"], {})
        self.assertEqual(source["payloadMapping"], ["Ditto"])
        self.assertNotIn("replyTarget", source)

        target = connection["targets"][0]
        self.assertEqual(
            target["address"],
            "smart-home/{{ thing:name }}/things/live/messages/{{ topic:subject }}",
        )
        self.assertEqual(target["topics"], ["_/_/things/live/messages"])
        self.assertEqual(target["qos"], 0)
        self.assertEqual(target["headerMapping"], {})
        self.assertEqual(target["payloadMapping"], ["Ditto"])
        self.assertNotIn("mappingDefinitions", connection)

    def test_example_environment_uses_cloud_broker(self):
        values = {}
        for line in (ROOT / "smart_grinder_simulator" / ".env.example").read_text().splitlines():
            if line and not line.startswith("#"):
                key, value = line.split("=", 1)
                values[key] = value

        self.assertEqual(values["MQTT_HOST"], "34.143.166.45")
        self.assertEqual(values["DITTO_MQTT_HOST"], "34.143.166.45")
        self.assertEqual(values["THING_ID"], "smart-home:grinder-01")

    def test_example_acl_allows_device_and_ditto_protocol_topics(self):
        acl = (
            ROOT / "ditto-ambassador" / "examples" / "mosquitto-grinder.acl"
        ).read_text(encoding="utf-8")

        self.assertIn(
            "topic readwrite grinder/smart-home:grinder-01/state",
            acl,
        )
        self.assertIn(
            "topic readwrite grinder/smart-home:grinder-01/commands",
            acl,
        )
        self.assertIn(
            "topic readwrite grinder/smart-home:grinder-01/responses",
            acl,
        )
        self.assertIn(
            "topic readwrite smart-home/grinder-01/things/#",
            acl,
        )
        self.assertNotIn("topic readwrite ditto/things/", acl)


if __name__ == "__main__":
    unittest.main()

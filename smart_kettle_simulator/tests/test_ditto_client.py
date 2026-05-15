from smart_kettle_simulator.ditto_client.payload_builder import DittoPayloadBuilder


def test_build_feature_payload_contains_water_and_power():
    payload = DittoPayloadBuilder().build_feature_payload({"temperature": 90, "power_status": "on"})
    assert "water" in payload
    assert "power" in payload

from smart_kettle_simulator.core.business_logic import CoreService
from smart_kettle_simulator.kettle_simulator.simulator import KettleSimulator


class DummyRepository:
    def can_execute_command(self, _thing_id, command):
        return command in {"turn_on", "turn_off", "set_target_temperature"}


def test_core_formats_payload_from_simulator_state():
    simulator = KettleSimulator()
    core = CoreService("smart-home:kettle-01", simulator, DummyRepository())
    payload = core.process_simulator_state(simulator.get_state())
    assert "water" in payload
    assert "power" in payload

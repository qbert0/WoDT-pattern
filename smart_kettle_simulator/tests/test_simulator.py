from smart_kettle_simulator.kettle_simulator.simulator import KettleSimulator


def test_turn_on_changes_power_status():
    simulator = KettleSimulator()
    state = simulator.apply_command("turn_on")
    assert state["power_status"] == "on"


def test_set_target_temperature_changes_state():
    simulator = KettleSimulator()
    state = simulator.apply_command("set_target_temperature", {"temperature": 95})
    assert state["target_temperature"] == 95

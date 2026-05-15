from smart_kettle_simulator.core.business_logic import CoreService
from smart_kettle_simulator.kettle_simulator.simulator import KettleSimulator


class DummyRepository:
    def can_execute_command(self, _thing_id, command):
        return command in {"turn_on", "turn_off", "set_target_temperature", "set_water_level"}


def test_core_formats_payload_from_simulator_state():
    simulator = KettleSimulator()
    core = CoreService("smart-home:kettle-01", simulator, DummyRepository())
    payload = core.process_simulator_state(simulator.get_state())
    assert "water" in payload
    assert "power" in payload


def test_simulator_command_bypasses_repository_validation():
    simulator = KettleSimulator()

    class RejectRepository:
        def can_execute_command(self, _thing_id, _command):
            return False

    core = CoreService("smart-home:kettle-01", simulator, RejectRepository())
    state = core.handle_simulator_command("turn_on")
    assert state["power_status"] == "on"


def test_build_command_sequence_from_goal_tasks():
    core = CoreService("smart-home:kettle-01", simulator=None, repository=None)

    class Task:
        def __init__(self, task_id, task_name, task_command, goal_id, goal_name, depends_on):
            self.task_id = task_id
            self.task_name = task_name
            self.task_command = task_command
            self.goal_id = goal_id
            self.goal_name = goal_name
            self.depends_on = depends_on

    commands = core.build_command_sequence(
        [
            Task("T_K4", "SetWaterVolume", "SET_VOLUME", "G_K1_2", "EnsureWater", []),
            Task("T_K3", "SetTemperature", "SET_TEMP", "G_K1_1", "HeatWater", []),
            Task("T_K1", "TurnOn", "TURN_ON", "G_K1_1", "HeatWater", ["T_K3", "T_K4"]),
        ],
        {"temperature": 95, "water_level": 80},
    )

    assert [item["device_command"] for item in commands] == [
        "set_water_level",
        "set_target_temperature",
        "turn_on",
    ]

from smart_kettle_simulator.core.models import KettleState, SimulationEvent


def build_state_update_event(state: KettleState) -> SimulationEvent:
    return SimulationEvent(event_type="state_update", payload=state.to_dict())


def build_command_event(command: str, payload: dict | None = None) -> SimulationEvent:
    return SimulationEvent(event_type=command, payload=payload or {})

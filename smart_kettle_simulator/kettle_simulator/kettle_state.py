from __future__ import annotations

from smart_kettle_simulator.core.models import KettleState


class KettleStateStore:
    def __init__(self, initial_state: KettleState | None = None) -> None:
        self._state = initial_state or KettleState()

    @property
    def state(self) -> KettleState:
        return self._state

    def snapshot(self) -> dict:
        return self._state.to_dict()

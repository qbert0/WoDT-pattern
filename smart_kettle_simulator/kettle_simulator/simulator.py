from __future__ import annotations

import threading
import time
from typing import Callable, Optional

from smart_kettle_simulator.core.models import KettleState
from smart_kettle_simulator.kettle_simulator.business_logic import KettleBusinessLogic


class KettleSimulator:
    def __init__(
        self,
        initial_state: KettleState | None = None,
        on_state_change: Optional[Callable[[dict], None]] = None,
    ) -> None:
        self.state = initial_state or KettleState()
        self.logic = KettleBusinessLogic(self.state)
        self.on_state_change = on_state_change
        self.running = False
        self._thread: threading.Thread | None = None

    def start(self, update_interval: float = 2.0) -> None:
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(
            target=self._simulation_loop,
            args=(update_interval,),
            daemon=True,
        )
        self._thread.start()

    def _simulation_loop(self, update_interval: float) -> None:
        while self.running:
            new_state = self.logic.update_physics()
            self._emit(new_state.to_dict())
            time.sleep(update_interval)

    def apply_command(self, command: str, params: dict | None = None) -> dict:
        new_state = self.logic.handle_command(command, params or {})
        self._emit(new_state.to_dict())
        return new_state.to_dict()

    def get_state(self) -> dict:
        return self.state.to_dict()

    def stop(self) -> None:
        self.running = False
        if self._thread:
            self._thread.join(timeout=1)

    def _emit(self, state: dict) -> None:
        if self.on_state_change:
            self.on_state_change(state)

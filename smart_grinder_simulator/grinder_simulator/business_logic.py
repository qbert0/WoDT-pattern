from __future__ import annotations

import math
import time

from smart_grinder_simulator.core.exceptions import ValidationError
from smart_grinder_simulator.core.models import GrinderState


class GrinderBusinessLogic:
    def __init__(self, state: GrinderState, grind_duration_seconds: int = 60) -> None:
        self.state = state
        self.state.grind_duration_seconds = max(1, grind_duration_seconds)
        self._grind_started_at: float | None = None

    def update_physics(self) -> GrinderState:
        if self.state.grinder_status != "grinding":
            self.state.touch()
            return self.state

        if self._grind_started_at is None:
            self._grind_started_at = time.monotonic()

        elapsed = time.monotonic() - self._grind_started_at
        remaining = max(0, math.ceil(self.state.grind_duration_seconds - elapsed))
        self.state.remaining_seconds = remaining

        if remaining == 0:
            self.state.power_status = "off"
            self.state.grinder_status = "completed"
            self.state.grind_complete = True
            self.state.bean_amount = 0
            self._grind_started_at = None
            self.state.touch()
            return self.state

        self.state.touch()
        return self.state

    def handle_command(self, command: str, params: dict | None = None) -> GrinderState:
        params = params or {}

        if command == "grind":
            if self.state.target_amount <= 0:
                raise ValidationError("Target bean amount must be greater than 0.")
            self.state.bean_amount = self.state.target_amount
            self.state.power_status = "on"
            self.state.grinder_status = "grinding"
            self.state.grind_complete = False
            self.state.remaining_seconds = self.state.grind_duration_seconds
            self._grind_started_at = time.monotonic()
        elif command == "stop":
            self.state.power_status = "off"
            self.state.grinder_status = "idle"
            self.state.remaining_seconds = 0
            self._grind_started_at = None
        elif command == "set_bean_amount":
            amount = int(params.get("amount", 0))
            if not 0 <= amount <= 100:
                raise ValidationError("Bean amount must be between 0 and 100.")
            self.state.target_amount = amount
            self.state.bean_amount = amount
            self.state.grind_complete = amount == 0
            if amount == 0:
                self.state.power_status = "off"
                self.state.grinder_status = "idle"
                self.state.remaining_seconds = 0
                self._grind_started_at = None
        else:
            raise ValidationError(f"Unsupported command: {command}")

        self.state.touch()
        return self.state

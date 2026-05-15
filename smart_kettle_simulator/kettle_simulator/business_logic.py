from __future__ import annotations

import random

from smart_kettle_simulator.core.exceptions import ValidationError
from smart_kettle_simulator.core.models import KettleState


class KettleBusinessLogic:
    def __init__(self, state: KettleState) -> None:
        self.state = state

    def update_physics(self) -> KettleState:
        current_temp = self.state.temperature

        if self.state.power_status == "off":
            if current_temp > 25:
                self.state.temperature = round(max(25, current_temp - 0.3), 1)
            self.state.touch()
            return self.state

        if self.state.water_level <= 0:
            self.state.power_status = "off"
            self.state.touch()
            return self.state

        target = self.state.target_temperature
        if current_temp < target:
            increase = random.uniform(0.5, 1.2)
            new_temp = min(target, current_temp + increase)
            self.state.temperature = round(new_temp, 1)
        elif current_temp > target:
            self.state.temperature = round(max(target, current_temp - 0.2), 1)
            self.state.power_status = "off"
        else:
            self.state.power_status = "off"

        self.state.touch()
        return self.state

    def handle_command(self, command: str, params: dict | None = None) -> KettleState:
        params = params or {}

        if command == "turn_on":
            if self.state.water_level <= 0:
                raise ValidationError("Water level must be greater than 0 before turning on.")
            self.state.power_status = "on"
        elif command == "turn_off":
            self.state.power_status = "off"
        elif command == "set_target_temperature":
            target = int(params.get("temperature", 100))
            if not 70 <= target <= 100:
                raise ValidationError("Target temperature must be between 70 and 100.")
            self.state.target_temperature = target
        elif command == "set_water_level":
            water_level = int(params.get("water_level", 0))
            if not 0 <= water_level <= 100:
                raise ValidationError("Water level must be between 0 and 100.")
            self.state.water_level = water_level
            if water_level == 0:
                self.state.power_status = "off"
        else:
            raise ValidationError(f"Unsupported command: {command}")

        self.state.touch()
        return self.state

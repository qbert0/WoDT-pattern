from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict


@dataclass
class KettleState:
    temperature: float = 25.0
    water_level: int = 50
    power_status: str = "off"
    heating_status: str = "idle"
    power_consumption: int = 0
    target_temperature: int = 100
    total_boils: int = 0
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def touch(self) -> None:
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

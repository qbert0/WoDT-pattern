from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List


@dataclass
class GrinderState:
    power_status: str = "off"
    grinder_status: str = "idle"
    bean_amount: int = 20
    target_amount: int = 20
    grind_complete: bool = False
    grind_duration_seconds: int = 60
    remaining_seconds: int = 0
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def touch(self) -> None:
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TaskPlan:
    task_id: str
    task_name: str
    task_command: str
    goal_id: str
    goal_name: str
    depends_on: List[str] = field(default_factory=list)

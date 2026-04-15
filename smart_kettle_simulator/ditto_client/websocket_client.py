from __future__ import annotations

from typing import Callable, Optional


class DittoWebSocketClient:
    """Placeholder for Ditto live updates."""

    def __init__(self, on_message: Optional[Callable[[dict], None]] = None) -> None:
        self.on_message = on_message

    def connect(self) -> None:
        return None

    def close(self) -> None:
        return None

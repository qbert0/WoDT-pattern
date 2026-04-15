from __future__ import annotations

from typing import Any, Dict

from smart_kettle_simulator.neo4j_module.repository import KettleRepository


class GraphAnalyzer:
    def __init__(self, repository: KettleRepository) -> None:
        self.repository = repository

    def summarize_capabilities(self, thing_id: str) -> Dict[str, Any]:
        capabilities = self.repository.get_all_capabilities(thing_id)
        return {
            "thing_id": thing_id,
            "capability_count": len(capabilities),
            "capabilities": capabilities,
        }

from __future__ import annotations

from typing import Any, Dict, List

from smart_kettle_simulator.neo4j_module.connection import Neo4jConnection
from smart_kettle_simulator.neo4j_module import queries


class KettleRepository:
    def __init__(self, connection: Neo4jConnection) -> None:
        self.connection = connection

    def get_all_capabilities(self, thing_id: str) -> List[Dict[str, Any]]:
        with self.connection.session() as session:
            result = session.run(queries.GET_ALL_CAPABILITIES, thing_id=thing_id)
            return [record.data() for record in result]

    def get_control_capabilities(self, thing_id: str) -> List[Dict[str, Any]]:
        with self.connection.session() as session:
            result = session.run(queries.GET_CONTROL_CAPABILITIES, thing_id=thing_id)
            return [record.data() for record in result]

    def can_execute_command(self, thing_id: str, command: str) -> bool:
        with self.connection.session() as session:
            record = session.run(
                queries.CAN_EXECUTE_COMMAND,
                thing_id=thing_id,
                command=command,
            ).single()
            return bool(record["can_execute"]) if record else False

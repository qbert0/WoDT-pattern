from __future__ import annotations

from smart_kettle_simulator.neo4j_module.connection import Neo4jConnection


class RelationshipManager:
    def __init__(self, connection: Neo4jConnection) -> None:
        self.connection = connection

    def create_relationship(self, query: str, **params) -> None:
        with self.connection.session() as session:
            session.run(query, **params)

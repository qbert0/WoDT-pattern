from __future__ import annotations

class Neo4jConnection:
    def __init__(self, uri: str, user: str, password: str) -> None:
        from neo4j import GraphDatabase

        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def session(self):
        return self.driver.session()

    def close(self) -> None:
        self.driver.close()

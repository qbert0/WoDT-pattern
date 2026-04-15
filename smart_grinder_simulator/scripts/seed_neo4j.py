from pathlib import Path


def main() -> None:
    query_file = Path(__file__).resolve().parents[1] / "neo4j_module" / "grinder_graph.cypher"
    print(f"Run this Cypher in Neo4j Browser: {query_file}")


if __name__ == "__main__":
    main()

"""Preview optional Cypher; --apply adds only the allocation contract."""
import argparse
import os
from pathlib import Path
from neo4j import GraphDatabase
from .graph import load_contract


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    source = Path(__file__).resolve().parents[1] / 'cypher' / 'waretwin_allocation.cypher'
    query = '\n'.join(line for line in source.read_text().splitlines() if not line.lstrip().startswith('//')).strip().rstrip(';')
    if not args.apply:
        print(query)
        return
    with GraphDatabase.driver(os.environ['NEO4J_URI'], auth=(os.environ['NEO4J_USER'], os.environ['NEO4J_PASSWORD'])) as driver:
        with driver.session(database=os.getenv('NEO4J_DATABASE') or None) as session:
            def apply(tx):
                tx.run(query).consume()
                return load_contract(tx)
            contract = session.execute_write(apply)
            print(f'Applied T_ORDER_ASSIGN for {contract.goal_id} / {contract.agent_id}')


if __name__ == '__main__':
    main()

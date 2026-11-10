"""Run from WoDT-pattern: python -m task_allocator [--shadow]."""
import argparse
import logging
import os
import time
from urllib.parse import quote
import httpx
from neo4j import GraphDatabase, READ_ACCESS
from .graph import load_contract
from .service import decisions
from .conditions import evaluate

log = logging.getLogger('task_allocator')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--shadow', action='store_true', help='Read and score without sending assignments')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    required = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'DITTO_USER', 'DITTO_PASSWORD']
    if not args.shadow: required.append('FLEET_API_KEY')
    for key in required:
        if not os.environ.get(key): parser.error(f'Missing {key}')
    fleet = os.getenv('WARETWIN_URL', 'http://localhost:8000').rstrip('/')
    ditto = os.getenv('DITTO_URL', 'http://localhost:8080').rstrip('/')
    namespace = os.getenv('TWIN_MQTT_NAMESPACE', 'waretwin')
    period = float(os.getenv('ALLOCATOR_INTERVAL_S', '0.5'))
    max_age = float(os.getenv('ALLOCATOR_MAX_AGE_S', '5'))
    if period <= 0 or max_age <= 0: parser.error('Intervals must be positive')
    with GraphDatabase.driver(os.environ['NEO4J_URI'], auth=(os.environ['NEO4J_USER'], os.environ['NEO4J_PASSWORD'])) as driver:
        with driver.session(database=os.getenv('NEO4J_DATABASE') or None, default_access_mode=READ_ACCESS) as session:
            contract = session.execute_read(load_contract)
    log.info('Loaded goal=%s agent=%s shadow=%s', contract.goal_id, contract.agent_id, args.shadow)
    # Separate clients: never forward Ditto credentials to the Fleet API.
    with httpx.Client(base_url=ditto, auth=(os.environ['DITTO_USER'], os.environ['DITTO_PASSWORD']), timeout=5) as twin, \
         httpx.Client(base_url=fleet, headers={'X-Fleet-Key': os.getenv('FLEET_API_KEY', '')}, timeout=5) as executor:
        layout, run_id, last_snapshot = None, None, None
        while True:
            try:
                response = twin.get('/api/2/things/' + quote(namespace + ':warehouse', safe='') + '/features/dispatch/properties')
                response.raise_for_status()
                snapshot = response.json()['snapshot']
                key = (snapshot['run_id'], snapshot['tick'])
                if key != last_snapshot:
                    if run_id != snapshot['run_id'] or layout is None:
                        response = executor.get('/api/layout'); response.raise_for_status()
                        layout = response.json(); run_id = snapshot['run_id']
                    last_snapshot = key
                    if args.shadow:
                        snapshot = {**snapshot, "mode": "external"}
                    for decision in decisions(snapshot, layout, contract, max_age=max_age):
                        if args.shadow:
                            log.info('Shadow task=%s robot=%s', decision['task_id'], decision['robot_id'])
                            continue
                        # One retry uses exactly the same ID; commit is idempotent.
                        for attempt in range(2):
                            try:
                                response = executor.post('/api/fleet/assignments', json=decision)
                                break
                            except httpx.TransportError:
                                if attempt: raise
                        if response.status_code == 409:
                            log.info('Decision rejected: %s', response.text)
                            break
                        response.raise_for_status()
                        result = response.json()
                        if evaluate(contract.postcondition, result['context']) is not True:
                            raise ValueError('Assignment postcondition not confirmed')
                        log.info('Assigned task=%s robot=%s decision=%s', decision['task_id'], decision['robot_id'], decision['decision_id'])
            except (httpx.HTTPError, ValueError, KeyError, TypeError, OverflowError) as exc:
                log.warning('Round skipped: %s', type(exc).__name__)
            time.sleep(period)


if __name__ == '__main__':
    main()

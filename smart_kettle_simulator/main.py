from smart_kettle_simulator.core.business_logic import CoreService
from smart_kettle_simulator.core.config import settings
from smart_kettle_simulator.kettle_simulator.simulator import KettleSimulator
from smart_kettle_simulator.neo4j_module.connection import Neo4jConnection
from smart_kettle_simulator.neo4j_module.repository import KettleRepository
from smart_kettle_simulator.ditto_client.mqtt_bridge import DittoMQTTClient


def build_repository() -> KettleRepository | None:
    try:
        connection = Neo4jConnection(
            settings.neo4j_uri,
            settings.neo4j_user,
            settings.neo4j_password,
        )
        return KettleRepository(connection)
    except Exception as exc:
        print(f"[Neo4j] Disabled: {exc}")
        return None


def main() -> None:
    simulator = KettleSimulator()
    repository = build_repository()
    core = CoreService(settings.thing_id, simulator, repository)
    ditto = DittoMQTTClient(
        broker_host=settings.ditto_mqtt_host,
        broker_port=settings.ditto_mqtt_port,
        username=settings.ditto_mqtt_username,
        password=settings.ditto_mqtt_password,
        thing_id=settings.thing_id,
        on_command=core.handle_command,
    )

    simulator.on_state_change = lambda state: ditto.publish_state(
        core.process_simulator_state(state)
    )
    ditto.connect()
    simulator.start(settings.simulation_interval)
    run_cli(core, simulator, ditto)


def run_cli(core: CoreService, simulator: KettleSimulator, ditto: DittoMQTTClient) -> None:
    while True:
        try:
            raw = input("> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            shutdown(simulator, ditto)
            return

        if raw == "quit":
            shutdown(simulator, ditto)
            return
        if raw == "status":
            print(simulator.get_state())
            continue
        if raw == "on":
            print(core.handle_command("turn_on"))
            continue
        if raw == "off":
            print(core.handle_command("turn_off"))
            continue
        if raw.startswith("temp "):
            _, value = raw.split(maxsplit=1)
            print(core.handle_command("set_target_temperature", {"temperature": int(value)}))
            continue
        print("Supported commands: on, off, temp <70-100>, status, quit")


def shutdown(simulator: KettleSimulator, ditto: DittoMQTTClient) -> None:
    simulator.stop()
    ditto.disconnect()


if __name__ == "__main__":
    main()

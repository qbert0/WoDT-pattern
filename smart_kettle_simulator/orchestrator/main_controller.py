from __future__ import annotations

from smart_kettle_simulator.core.config import settings
from smart_kettle_simulator.ditto_client.ditto_api import DittoAPI
from smart_kettle_simulator.ditto_client.thing_manager import ThingManager
from smart_kettle_simulator.kettle_simulator.simulator import KettleSimulator
from smart_kettle_simulator.neo4j_module.connection import Neo4jConnection
from smart_kettle_simulator.neo4j_module.repository import KettleRepository
from smart_kettle_simulator.orchestrator.data_sync import DataSyncService
from smart_kettle_simulator.orchestrator.event_handler import EventHandler


class MainController:
    def __init__(self) -> None:
        self.neo4j_connection = Neo4jConnection(
            settings.neo4j_uri,
            settings.neo4j_user,
            settings.neo4j_password,
        )
        self.repository = KettleRepository(self.neo4j_connection)
        self.ditto_api = DittoAPI(
            settings.ditto_base_url,
            settings.ditto_username,
            settings.ditto_password,
        )
        self.thing_manager = ThingManager(settings.thing_id, self.ditto_api)
        self.data_sync = DataSyncService(self.thing_manager)
        self.event_handler = EventHandler(settings.thing_id, self.repository, self.data_sync)
        self.simulator = KettleSimulator(on_event=self.event_handler.handle_simulator_event)

    def bootstrap(self) -> None:
        self.thing_manager.register_thing(self.simulator.get_state())

    def run(self) -> None:
        self.bootstrap()
        self.simulator.start(settings.simulation_interval)
        self._command_loop()

    def _command_loop(self) -> None:
        while True:
            try:
                raw = input("> ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                self.shutdown()
                break

            if raw == "quit":
                self.shutdown()
                break
            if raw == "status":
                print(self.simulator.get_state())
                continue
            if raw == "on":
                self._dispatch_command("turn_on")
                continue
            if raw == "off":
                self._dispatch_command("turn_off")
                continue
            if raw.startswith("temp "):
                _, value = raw.split(maxsplit=1)
                self._dispatch_command("set_target_temperature", {"temperature": int(value)})
                continue
            print("Supported commands: on, off, temp <70-100>, status, quit")

    def _dispatch_command(self, command: str, params: dict | None = None) -> None:
        if not self.event_handler.validate_command(command):
            print(f"Command not supported by knowledge graph: {command}")
            return
        state = self.simulator.apply_command(command, params)
        print(state)

    def shutdown(self) -> None:
        self.simulator.stop()
        self.neo4j_connection.close()

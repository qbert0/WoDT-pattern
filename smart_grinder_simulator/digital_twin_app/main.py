from __future__ import annotations

from typing import Any, Dict

from smart_grinder_simulator.core.business_logic import CoreService
from smart_grinder_simulator.core.config import settings
from smart_grinder_simulator.ditto_client.ditto_bridge import DittoTwinBridge
from smart_grinder_simulator.ditto_client.mqtt_bridge import GrinderMQTTBridge
from smart_grinder_simulator.ditto_client.payload_builder import DittoPayloadBuilder
from smart_grinder_simulator.neo4j_module.connection import Neo4jConnection
from smart_grinder_simulator.neo4j_module.repository import GrinderRepository


class DigitalTwinRuntime:
    def __init__(self, repository: GrinderRepository | None) -> None:
        self.repository = repository
        self.core = CoreService(settings.thing_id, simulator=None, repository=repository)
        self.last_state: Dict[str, Any] = {}
        self.payload_builder = DittoPayloadBuilder()
        self.bridge = GrinderMQTTBridge(
            broker_host=settings.mqtt_host,
            broker_port=settings.mqtt_port,
            username=settings.mqtt_username,
            password=settings.mqtt_password,
            thing_id=settings.thing_id,
            on_state=self._on_state,
            on_response=self._on_response,
        )
        self.ditto_bridge = DittoTwinBridge(
            broker_host=settings.ditto_mqtt_host,
            broker_port=settings.ditto_mqtt_port,
            username=settings.ditto_mqtt_username,
            password=settings.ditto_mqtt_password,
            thing_id=settings.thing_id,
            on_ditto_command=self._on_ditto_command,
        )

    def _on_state(self, payload: Dict[str, Any]) -> None:
        self.last_state = payload
        self.ditto_bridge.publish_features(payload)

    def _on_response(self, payload: Dict[str, Any]) -> None:
        print(f"[DT Response] {payload}")

    def _on_ditto_command(self, command: str, params: Dict[str, Any]) -> None:
        print(f"[Ditto -> DT] forward {command} {params}")
        self.execute_dt_command(command, params)

    def connect(self) -> bool:
        twin_connected = self.bridge.connect_twin()
        ditto_connected = self.ditto_bridge.connect()
        if ditto_connected:
            self.ditto_bridge.publish_attributes(
                self.payload_builder.build_attributes_payload(
                    settings.thing_id,
                    settings.goal_root_id,
                )["attributes"]
            )
        return twin_connected

    def print_status(self) -> None:
        print(self.last_state or {"status": "No device state received yet."})

    def print_goal_plan(self, goal_id: str) -> None:
        if not self.repository:
            print("Neo4j repository is not available.")
            return

        goals = self.repository.get_goal_tree(goal_id)
        tasks = self.repository.build_execution_plan(goal_id)

        print("Goals:")
        for goal in goals:
            indent = "  " * goal["depth"]
            print(f"{indent}- {goal['goal_id']}: {goal['goal_name']}")

        print("Tasks:")
        for task in tasks:
            print(
                f"- {task.task_id}: {task.task_name} ({task.task_command}) "
                f"depends_on={task.depends_on}"
            )

    def execute_goal(self, goal_id: str, params: Dict[str, Any]) -> None:
        if not self.repository:
            print("Neo4j repository is not available.")
            return

        plan = self.repository.build_execution_plan(goal_id)
        commands = self.core.build_command_sequence(plan, params)
        if not commands:
            print(f"No executable commands found for goal {goal_id}.")
            return

        for command in commands:
            print(f"[DT] send {command['device_command']} {command['params']}")
            self.bridge.publish_command(command["device_command"], command["params"])

    def execute_dt_command(self, command: str, params: Dict[str, Any] | None = None) -> None:
        print(f"[DT] send {command} {params or {}}")
        self.bridge.publish_command(command, params or {})

    def shutdown(self) -> None:
        self.bridge.disconnect()
        self.ditto_bridge.disconnect()


def build_repository() -> GrinderRepository | None:
    try:
        connection = Neo4jConnection(
            settings.neo4j_uri,
            settings.neo4j_user,
            settings.neo4j_password,
        )
        return GrinderRepository(connection)
    except Exception as exc:
        print(f"[Neo4j] Disabled: {exc}")
        return None


def main() -> None:
    runtime = DigitalTwinRuntime(build_repository())
    runtime.connect()
    run_cli(runtime)


def run_cli(runtime: DigitalTwinRuntime) -> None:
    help_text = (
        "Twin commands: status, plan <goal_id>, goal <goal_id> [amount], "
        "cmd grind|stop|amount <v>, quit"
    )

    while True:
        try:
            raw = input("grinder-dt> ").strip()
        except (EOFError, KeyboardInterrupt):
            runtime.shutdown()
            return

        if not raw:
            continue

        parts = raw.split()
        command = parts[0].lower()

        if command == "quit":
            runtime.shutdown()
            return
        if command == "status":
            runtime.print_status()
            continue
        if command == "plan" and len(parts) >= 2:
            runtime.print_goal_plan(parts[1])
            continue
        if command == "goal" and len(parts) >= 2:
            params: Dict[str, Any] = {}
            if len(parts) >= 3:
                params["amount"] = int(parts[2])
            runtime.execute_goal(parts[1], params)
            continue
        if command == "cmd" and len(parts) >= 2:
            dt_command = parts[1].lower()
            if dt_command == "grind":
                runtime.execute_dt_command("grind")
                continue
            if dt_command == "stop":
                runtime.execute_dt_command("stop")
                continue
            if dt_command == "amount" and len(parts) >= 3:
                runtime.execute_dt_command("set_bean_amount", {"amount": int(parts[2])})
                continue

        print(help_text)


if __name__ == "__main__":
    main()

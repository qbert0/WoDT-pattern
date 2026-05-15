from smart_grinder_simulator.core.business_logic import CoreService
from smart_grinder_simulator.core.config import settings
from smart_grinder_simulator.ditto_client.mqtt_bridge import GrinderMQTTBridge
from smart_grinder_simulator.grinder_simulator.simulator import GrinderSimulator


def main() -> None:
    simulator = GrinderSimulator(
        grind_duration_seconds=settings.grind_duration_seconds,
    )
    core = CoreService(settings.thing_id, simulator=simulator)
    bridge = GrinderMQTTBridge(
        broker_host=settings.mqtt_host,
        broker_port=settings.mqtt_port,
        username=settings.mqtt_username,
        password=settings.mqtt_password,
        thing_id=settings.thing_id,
        on_device_command=core.handle_device_command,
    )

    simulator.on_state_change = lambda state: bridge.publish_state(
        core.process_device_state(state)
    )

    mqtt_connected = bridge.connect_device()
    simulator.start(settings.simulation_interval)
    if mqtt_connected:
        bridge.publish_state(core.process_device_state(simulator.get_state()))

    run_cli(core, simulator, bridge)


def run_cli(core: CoreService, simulator: GrinderSimulator, bridge: GrinderMQTTBridge) -> None:
    while True:
        try:
            raw = input("grinder-sim> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            shutdown(simulator, bridge)
            return

        if raw == "quit":
            shutdown(simulator, bridge)
            return
        if raw == "status":
            print(simulator.get_state())
            continue
        if raw == "grind":
            print(core.handle_device_command("grind"))
            continue
        if raw == "stop":
            print(core.handle_device_command("stop"))
            continue
        if raw.startswith("amount "):
            _, value = raw.split(maxsplit=1)
            print(core.handle_device_command("set_bean_amount", {"amount": int(value)}))
            continue
        print("Simulator commands: grind, stop, amount <0-100>, status, quit")


def shutdown(simulator: GrinderSimulator, bridge: GrinderMQTTBridge) -> None:
    simulator.stop()
    bridge.disconnect()


if __name__ == "__main__":
    main()

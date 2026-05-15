from smart_kettle_simulator.core.business_logic import CoreService
from smart_kettle_simulator.core.config import settings
from smart_kettle_simulator.ditto_client.mqtt_bridge import KettleMQTTBridge
from smart_kettle_simulator.kettle_simulator.simulator import KettleSimulator


def main() -> None:
    simulator = KettleSimulator()
    core = CoreService(settings.thing_id, simulator=simulator)
    bridge = KettleMQTTBridge(
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


def run_cli(core: CoreService, simulator: KettleSimulator, bridge: KettleMQTTBridge) -> None:
    while True:
        try:
            raw = input("sim> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            shutdown(simulator, bridge)
            return

        if raw == "quit":
            shutdown(simulator, bridge)
            return
        if raw == "status":
            print(simulator.get_state())
            continue
        if raw == "on":
            print(core.handle_device_command("turn_on"))
            continue
        if raw == "off":
            print(core.handle_device_command("turn_off"))
            continue
        if raw.startswith("temp "):
            _, value = raw.split(maxsplit=1)
            print(core.handle_device_command("set_target_temperature", {"temperature": int(value)}))
            continue
        if raw.startswith("water "):
            _, value = raw.split(maxsplit=1)
            print(core.handle_device_command("set_water_level", {"water_level": int(value)}))
            continue
        print("Simulator commands: on, off, temp <70-100>, water <0-100>, status, quit")


def shutdown(simulator: KettleSimulator, bridge: KettleMQTTBridge) -> None:
    simulator.stop()
    bridge.disconnect()


if __name__ == "__main__":
    main()

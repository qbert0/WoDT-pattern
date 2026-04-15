from smart_kettle_simulator.api.routes import healthcheck


def create_app() -> dict:
    return {"healthcheck": healthcheck()}

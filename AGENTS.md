# AGENTS.md

WoDT-pattern is a multi-runtime demo system (Digital Twins over Eclipse Ditto). There is no root build, monorepo tooling, CI, or pre-commit config. The root `package-lock.json` is an empty stub. Each component is installed and run independently.

## Components

| Path | What it is | Run / test |
| --- | --- | --- |
| `ditto-ambassador/` | Spring Boot 4.1 (Java 21) HTTP gateway in front of Eclipse Ditto. Proxies `/api/2/**` and adds create-only `PUT /api/digital-twins/{thingId}`. Default port **8081**. | `cd ditto-ambassador && mvn spring-boot:run`; tests `mvn test` |
| `client-aplication/` | React 18 + Vite 4 web UI ("Ditto Studio"). Main documented web UI. Port 5173. | `npm install && npm run dev`; tests `npm test` (vitest); build `npm run build` |
| `WoDT/` | Nuxt 4 app with server API routes (`server/api/**`) for Ditto/Neo4j. Port 3000. Reads config from `NUXT_PUBLIC_*` / `NEO4J_*` env directly; no `.env.example`. | `npm install && npm run dev` |
| `smart_kettle_simulator/` | Python. Kettle simulator + Digital Twin app, MQTT + Ditto. | run from repo root: `python -m smart_kettle_simulator.scripts.run_digital_twin` and `...run_simulation`; tests `python -m pytest smart_kettle_simulator/tests` |
| `smart_grinder_simulator/` | Python. Coffee grinder simulator + DT app (same module layout). | `python -m smart_grinder_simulator.scripts.run_simulation` / `...run_digital_twin`; tests `python -m pytest smart_grinder_simulator/tests` |
| `mqtt_project/` | Legacy MQTT bridge / Ditto connection templates. | see caveat below |
| `cypher/` | Goal knowledge-graph `.cypher` files. Run order: `kettle_kg` → `grinder_kg` → `system_kg` → `integration_relations`. |
| `neo4j/` | Neo4j runtime data/logs committed to git. Not source. |

## Traps an agent will hit

- **Ambassador runs on 8081, not 8080.** `run-commands.md` says 8080 (stale). `application.yml`, `.env.example`, and every cross-service doc use 8081. 8080 is the upstream Ditto REST API.
- **`run-all.ps1` hardcodes Windows paths** (`e:\WoDT-pattern\...`) and PowerShell `Start-Process`. It will not work from this Linux checkout; start components manually.
- **`mqtt_project/main.py` is not the MQTT bridge.** It is a stray standalone Neo4j demo with a hardcoded IP that prints and exits. The actual bridge logic is in `mqtt_project/mqtt_bridge.py` / `business_logic.py` / `simulator.py`. Ignore `run-commands.md`'s `cd mqtt_project && python main.py`.
- **`goalRootId` was renamed to `goalAgentId`.** Active code (`ditto-ambassador`, `client-aplication`, both simulators' `payload_builder.py`) uses `attributes.goalAgentId`, endpoint `GET /api/digital-twins/goal-agent-availability?goalAgentId=...`, and error code `GOAL_AGENT_ALREADY_EXISTS`. The env var is still `GOAL_ROOT_ID`, and `WoDT/server/utils/system.ts` still reads legacy `goalRootId`. Treat docs that describe `goalRootId` as stale.
- **`client-aplication` has no ESLint config**, so `npm run lint` fails. `npm test` and `npm run build` work.
- **`.env` files are gitignored but present locally**, and several already contain real secrets (Neo4j credentials in `client-aplication/.env`). Never commit them; change credentials before using against any shared Ditto/Neo4j.
- **Docs reference files that do not exist**: `ditto-ambassador/scripts/create-grinder-mqtt-connection.sh` and `ditto-ambassador/examples/*.json.template`.

## Domain conventions worth knowing

- **Ambassador is create-only for twins**: `PUT /api/digital-twins/{thingId}` uses `If-None-Match: *`; a duplicate `thingId` returns `409 DIGITAL_TWIN_ALREADY_EXISTS`, a duplicate `goalAgentId` returns `409 GOAL_AGENT_ALREADY_EXISTS`. It also strips client `Authorization` on `/api/2/**` and injects backend credentials.
- **Two separate channels**: Ambassador is HTTP only. Runtime telemetry/commands go over MQTT through a Ditto Connection using the built-in `Ditto` payload mapping. 8081 is not an MQTT port.
- **MQTT topic contract** (per Thing, e.g. `smart-home:kettle-01`): device topics `kettle/{THING_ID}/state|commands|responses`; Ditto topics `{ns}/{name}/things/twin/commands/modify` and `.../things/live/messages/{subject}[/response]`.
- **Digital Twin apps must subscribe `.../live/messages/+`, never `#`** — `#` also matches the `/response` topic and creates a message loop.
- **Ditto Connection target selector must be `_/_/things/live/messages`** (with `{{ topic:subject }}`); `*/*/...` is rejected and `twin/events` does not forward commands. Policy must grant `nginx:ditto` READ+WRITE on `thing:/` and `message:/`.
- **Live message calls need `channel=live`** (e.g. `?channel=live&timeout=10`), otherwise the message goes to the twin channel and the caller times out. An HTTP `2xx`/`accepted=true` only acknowledges forward; the physical result arrives later via device state.
- **Run the DT app before the simulator** so it is subscribed when state is published.

## Reference docs

Detailed, mostly-Vietnamese component docs live in `docs/` (`smart-kettle-simulator.md`, `smart-grinder-simulator.md`, `digital-twin-components.md`) and per-component `README.md` files. They are the authoritative deep dives, but cross-check against code for the `goalAgentId` rename, the 8081 port, and non-existent paths listed above.

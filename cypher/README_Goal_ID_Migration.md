# Goal ID migration

The canonical rename table is `../goal_model/ids.json`. Rename IDs on existing
Goal nodes; keep names, relationships, refinement types, tasks and delegations.
The new IDs describe purpose rather than a node's position in a hierarchy.

Thing scope is separate from a node rename: Robot uses `G_WT_TRANSPORT`, Lift uses
`G_WT_CROSSFLOOR`. Their intermediate transport goals retain the new semantic IDs.
Other affected Thing anchors follow the rename table. Dynamic task Things retain
`G_WT_ALLOC`; unmapped alert Things remain unmapped.

## Preparation and checks

Stop processes that publish mapping attributes, update their configuration and
source first, then migrate. WareTwin's source is in the sibling repository:
`backend/app/mqtt.py::SECTION_GOAL_ROOT` and `WAREHOUSE_GOAL_ROOT`.
The coffee simulators read `GOAL_ROOT_ID`; update existing local `.env` values too.
Do not commit environment files or migration journals.

Use the simulator venv, which contains the Neo4j driver and python-dotenv. Commands
below are run from the WoDT-pattern repository root. Neo4j configuration comes
from the environment or simulator `.env` files. Ditto defaults to the local
Ambassador proxy (`http://localhost:8081/api/2`); override with `--ditto-base`.

```bash
smart_kettle_simulator/.venv/bin/python cypher/migrate_goal_ids.py --check-seeds
```

This produces a read-only plan. `--check-seeds` temporarily renames the nodes and
replays all seeds in one transaction, verifies an identical graph, and rolls back.
Conflicting IDs, missing nodes, or structural differences fail validation.

## Apply and resume

Choose a new journal outside the repository. The journal is a private JSON file
(mode 0600) containing the graph snapshot, affected Thing attributes and progress.
It contains no connection credentials.

```bash
smart_kettle_simulator/.venv/bin/python cypher/migrate_goal_ids.py \
  --apply --check-seeds \
  --journal "$HOME/.local/state/wodt-pattern/goal-id-migration-v1.json"
```

Neo4j renames are atomic. Ditto updates are JSON merge patches containing only the
mapping fields, protected by `If-Match` using the current Thing ETag. Telemetry
revision races are retried; concurrent changes to mapping are conflicts.

Rerun the same command and journal to resume. Already applied values are verified
and skipped. Do not use a journal for another database or Ditto instance.
After a completed run, a fresh read-only plan should report zero changes.

The updated `seed_neo4j.py` refuses legacy IDs. Migrate an existing database before
seeding; creating new IDs with MERGE alone would leave duplicate hierarchies.
The simulator `.cypher` copies match the canonical coffee seed files.

## Verification

- Compare before/after snapshots: only the nine Goal `id` properties change.
- All previous node/relationship identities and relationship properties survive.
- Robot scope: 10 Goals / 6 Tasks / A_ROBOT; Lift: 7 Goals / 4 Tasks / A_LIFT.
- Warehouse scope: 32 Goals / 22 Tasks / 6 Agents.
- Replaying seeds must not change the graph; check inside a rolled-back transaction.
- Reload each UI scope and verify dependencies appear only when coordination is selected.
- Verify publishers regenerate the new attributes after reconnect/reset.

```bash
smart_kettle_simulator/.venv/bin/python -m unittest discover -s cypher/tests -v
cd client-aplication
RUN_GOAL_GRAPH_TESTS=1 npm test
npm run build
```

The opt-in integration tests query the configured Neo4j read-only; ordinary
`npm test` skips them. They cover hierarchy isolation, Agent anchors, nearest
responsible Agent, and one-hop coordination dependencies.

## Rollback

Stop mapping writers first. Revert publisher configuration/source to its prior
version when rolling back the live data. The UI's compatibility resolver supports
both the old and new IDs during the transition.

```bash
smart_kettle_simulator/.venv/bin/python cypher/migrate_goal_ids.py \
  --rollback --journal "$HOME/.local/state/wodt-pattern/goal-id-migration-v1.json"
```

Rollback restores only the journal's mapping fields and renamed IDs. It preserves
unrelated attributes, telemetry and graph edits. It refuses conflicting mapping
or ID changes. Resume an interrupted rollback with the same command. After a
completed rollback, use a new journal for a subsequent migration.

## Attribute compatibility

This migration keeps the running bridge convention: `goalAgentId` may contain a
Goal ID; WareTwin publishes it alongside `goalRootId`. Explicit Agent IDs are
also accepted by the UI and resolved through DELEGATED_TO. Changing Ambassador's
uniqueness rule and standardizing all values to Agent IDs are separate work.

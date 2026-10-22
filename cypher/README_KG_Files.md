# KG Files for Coffee and WareTwin

## Files

- `kettle_kg.md`: local goal KG of the kettle DT
- `grinder_kg.md`: local goal KG of the coffee grinder DT
- `system_kg.md`: system-level goal KG
- `integration_relations.md`: goal integration file between the system and the DTs, including DT-to-DT dependencies

### WareTwin (Eclipse Ditto `waretwin:*`)

- `waretwin_robot_kg.md`: goal KG of the AMR fleet (`robot-R01..R20`)
- `waretwin_lift_kg.md`: goal KG of the freight lifts (`lift-LIFT-1/2`)
- `waretwin_conveyor_kg.md`: goal KG of the conveyors (`conveyor-CV01..04`)
- `waretwin_zone_kg.md`: goal KG of the zones (`zone-A..D`, `zone-M`)
- `waretwin_perception_kg.md`: goal KG of cameras + sensors (`camera-*`, `sensor-*`)
- `waretwin_system_kg.md`: warehouse coordinator system goals + order tasks + fleet energy information task
- `waretwin_integration_relations.md`: system ↔ component and DT ↔ DT dependencies
- `waretwin_ditto_mapping.md`: mapping table Thing ↔ Agent ↔ root Goal

## Migration of existing databases

Existing databases must run [Goal ID migration](README_Goal_ID_Migration.md) before the updated seeds. The loader rejects legacy IDs to avoid creating duplicate hierarchies.

To convert existing cross-agent refinements without reseeding, use
[Goal dependency migration](README_Goal_Dependency_Migration.md). It previews the
changes, backs up the graph, and replaces only the affected relationships in one transaction.

## Recommended execution order

1. `kettle_kg.md`
2. `grinder_kg.md`
3. `system_kg.md`
4. `integration_relations.md`
5. `waretwin_robot_kg.md` → `waretwin_lift_kg.md` → `waretwin_conveyor_kg.md` → `waretwin_zone_kg.md` → `waretwin_perception_kg.md`
6. `waretwin_system_kg.md`
7. `waretwin_integration_relations.md`

## Modeling principle

- Model files contain agents, goals, `REFINES`, and explicit `DELEGATED_TO` responsibility. They also retain tasks and `OPERATIONALIZED_BY` where defined (including WareTwin order tasks).
- `REFINES` connects goals within the same responsible agent. `DEPENDS_ON {type: 'ACHIEVED'}` connects a parent goal to a subgoal delegated to another agent. `OPERATIONALIZED_BY` connects goals to executable tasks.
- Each WareTwin component agent has one directly assigned goal. LiftAgent is assigned `G_WT_CROSSFLOOR` (EnsureCrossFloorFlow), which refines into ProvideVerticalTransport and EnsureSafeGateOperation; RobotAgent is assigned `G_WT_TRANSPORT` (TransportGoods), which refines into ExecuteTransportTasks and MaintainBattery. The other component agents retain their component roots. Descendants inherit responsibility through the hierarchy, with tasks at the lowest level. `G_WT_ALLOC` is intentionally unassigned and operationalizes the four order tasks.
- Agents retain the same `Agent.id` across files. Responsibility is direct or inherited from the nearest delegated ancestor through `REFINES`, never through `DEPENDS_ON`. Robot is assigned only at TransportGoods, Lift only at EnsureCrossFloorFlow, and Conveyor at its component root.
- `MaintainFleetEnergy` has no refined subgoals and is operationalized only by `CollectRobotEnergyInformation` (`T_FLEET_COLLECT_ENERGY`). This is a KG task declaration; its telemetry handler is outside the seed files.
- Cross-model dependencies remain in the corresponding integration file: `integration_relations.md` for coffee and `waretwin_integration_relations.md` for WareTwin.

## WareTwin views and seeding

- Robot uses a small nested goal tree (`systemId`, `participants`, `goal`, `parameter_dependency`) in `../goal_model/waretwin_robot.json`, applied by `seed_neo4j.py` after topology seeding. Running the plain Cypher files alone does not load these properties. The loader also removes obsolete detailed Robot contract properties. See [Robot model documentation](../docs/waretwin-robot-goal-model.md).
- Validate without Neo4j: `python3 cypher/seed_neo4j.py --validate-only`. Seed only WareTwin: `python3 cypher/seed_neo4j.py --waretwin-only` (from repository root, with the Neo4j driver installed).

- **Hierarchy view:** start at the selected Root Goal ID, follow outgoing `REFINES`, and include `DELEGATED_TO` plus `OPERATIONALIZED_BY` tasks. The warehouse root has 5 goals, 1 agent and 5 tasks within the coordinator's responsibility. Component hierarchies remain separate. Stop at agents and tasks; do not expand `DEPENDS_ON` in this view.
- **Integration view:** explicitly inspect `DEPENDS_ON` to see coordination between models or tasks. These edges remain stored even when hidden in the local view.
- See [WareTwin mapping, system diagram and queries](waretwin_ditto_mapping.md) for all six roots, assignments and executable query examples.
- For WareTwin alone, execute the five component files in step 5, then system, then integration. `seed_neo4j.py` executes both coffee and WareTwin in the full order above; it is not a WareTwin-only command.
- Seed files have `.md` names but contain **plain Cypher with `//` comments**. The loader splits on semicolons and strips comment-only lines. Keep Markdown headings, code fences, Mermaid, and example queries in documentation files, not in seed files. Do not put semicolons in seed comments.
- Re-running seeds uses `MERGE` and targeted cleanup of obsolete assignments, three obsolete system-to-component dependencies, and five cross-agent refinements. It does not reset the database or delete nodes. Safety depends on Zone and Perception; their internal goals, tasks and assignments are preserved. Use the dependency migration for existing data to preserve other properties instead of replaying all seeds.

## Main exported service goals

- Kettle: `kettle::G_K1 = IncreaseWaterTemperature`
- Grinder: `grinder::G_G_PROVIDE_GROUND_COFFEE = ProvideGroundCoffee`
- System: `system::G_S_MAKE_COFFEE = MakeCoffee`

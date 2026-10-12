# KG Files for Kettle + Coffee Grinder + System

## Files
- `kettle_kg.cypher`: local goal KG of the kettle DT
- `grinder_kg.cypher`: local goal KG of the coffee grinder DT
- `system_kg.cypher`: system-level goal KG
- `integration_relations.cypher`: goal integration file between the system and the DTs, including DT-to-DT dependencies

### WareTwin (Eclipse Ditto `waretwin:*`)
- `waretwin_robot_kg.md`: goal KG of the AMR fleet (`robot-R01..R20`)
- `waretwin_lift_kg.md`: goal KG of the freight lifts (`lift-LIFT-1/2`)
- `waretwin_conveyor_kg.md`: goal KG of the conveyors (`conveyor-CV01..04`)
- `waretwin_zone_kg.md`: goal KG of the zones (`zone-A..M`)
- `waretwin_perception_kg.md`: goal KG of cameras + sensors (`camera-*`, `sensor-*`)
- `waretwin_system_kg.md`: warehouse coordinator system goals (incl. `AllocateOrders`) + order tasks
- `waretwin_integration_relations.md`: system ↔ component and DT ↔ DT dependencies
- `waretwin_ditto_mapping.md`: mapping table Thing ↔ Agent ↔ root Goal

## Recommended execution order
1. `kettle_kg.cypher`
2. `grinder_kg.cypher`
3. `system_kg.cypher`
4. `integration_relations.cypher`
5. `waretwin_robot_kg.md` → `waretwin_lift_kg.md` → `waretwin_conveyor_kg.md` → `waretwin_zone_kg.md` → `waretwin_perception_kg.md`
6. `waretwin_system_kg.md`
7. `waretwin_integration_relations.md`

## Modeling principle
- Each DT file contains only `Agent`, `Goal`, `DELEGATED_TO`, and `REFINES`.
- `Metric`, `Output`, and `Knowledge` are intentionally removed from the local KG files.
- The system file also follows the same goal-only structure.
- Cross-module relations are defined only in `integration_relations.cypher`.
- System goals are satisfied by or depend on goals exported by the two DTs.
- The two DTs can also have subgoal-level dependencies for coordination.

## Main exported service goals
- Kettle: `kettle::G_K1 = ProvideHotWater`
- Grinder: `grinder::G_G1 = ProvideGroundCoffee`
- System: `system::G_S1 = ServeCoffee`

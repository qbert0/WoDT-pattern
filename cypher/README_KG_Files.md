# KG Files for Kettle + Coffee Grinder + System

## Files
- `kettle_kg.cypher`: local goal KG of the kettle DT
- `grinder_kg.cypher`: local goal KG of the coffee grinder DT
- `system_kg.cypher`: system-level goal KG
- `integration_relations.cypher`: goal integration file between the system and the DTs, including DT-to-DT dependencies

## Recommended execution order
1. `kettle_kg.cypher`
2. `grinder_kg.cypher`
3. `system_kg.cypher`
4. `integration_relations.cypher`

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

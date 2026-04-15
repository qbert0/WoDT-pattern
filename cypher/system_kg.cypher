// =========================
// MERGE GOALS FOR SYSTEM
// =========================
MERGE (as:Agent {id: 'A_SYSTEM'})
SET as.name = 'SystemCoordinatorAgent';

MERGE (gs1:Goal {id: 'G_S1'})
SET gs1.name = 'ServeCoffee',
    gs1.category = 'strategic',
    gs1.goalType = 'achieve',
    gs1.description = 'The system serves coffee by coordinating hot water and ground coffee.';

MERGE (gs11:Goal {id: 'G_S1_1'})
SET gs11.name = 'ProvideHotWater',
    gs11.category = 'subgoal',
    gs11.goalType = 'achieve',
    gs11.description = 'Obtain hot water from the kettle subsystem.';

MERGE (gs12:Goal {id: 'G_S1_2'})
SET gs12.name = 'ProvideGroundCoffee',
    gs12.category = 'subgoal',
    gs12.goalType = 'achieve',
    gs12.description = 'Obtain ground coffee from the grinder subsystem.';

MERGE (gs13:Goal {id: 'G_S1_3'})
SET gs13.name = 'CombineHotWaterAndGroundCoffee',
    gs13.category = 'subgoal',
    gs13.goalType = 'achieve',
    gs13.description = 'Combine hot water and ground coffee to serve coffee.';

MERGE (gs131:Goal {id: 'G_S1_3_1'})
SET gs131.name = 'WaitForHotWaterAndGroundCoffee',
    gs131.category = 'leaf',
    gs131.goalType = 'achieve',
    gs131.description = 'Wait until both hot water and ground coffee are ready.';

MERGE (gs132:Goal {id: 'G_S1_3_2'})
SET gs132.name = 'ServeCoffeeCup',
    gs132.category = 'leaf',
    gs132.goalType = 'achieve',
    gs132.description = 'Serve coffee once both resources are ready.';

// REFINEMENT AND RESPONSIBILITY RELATIONS FOR SYSTEM
MATCH
  (as:Agent {id:'A_SYSTEM'}),
  (gs1:Goal {id:'G_S1'}),
  (gs11:Goal {id:'G_S1_1'}),
  (gs12:Goal {id:'G_S1_2'}),
  (gs13:Goal {id:'G_S1_3'}),
  (gs131:Goal {id:'G_S1_3_1'}),
  (gs132:Goal {id:'G_S1_3_2'})
MERGE (gs1)-[:REFINES]->(gs11)
MERGE (gs1)-[:REFINES]->(gs12)
MERGE (gs1)-[:REFINES]->(gs13)
MERGE (gs13)-[:REFINES]->(gs131)
MERGE (gs13)-[:REFINES]->(gs132)
MERGE (gs1)-[:DELEGATED_TO]->(as)
MERGE (gs11)-[:DELEGATED_TO]->(as)
MERGE (gs12)-[:DELEGATED_TO]->(as)
MERGE (gs13)-[:DELEGATED_TO]->(as)
MERGE (gs131)-[:DELEGATED_TO]->(as)
MERGE (gs132)-[:DELEGATED_TO]->(as);

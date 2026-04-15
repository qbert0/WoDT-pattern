// =========================
// MERGE GOALS FOR GRINDER
// =========================
MERGE (ac:Agent {id: 'A_GRINDER'})
SET ac.name = 'GrinderAgent';

MERGE (gc1:Goal {id: 'G_C1'})
SET gc1.name = 'GrindCoffeeBeans',
    gc1.category = 'strategic',
    gc1.goalType = 'achieve',
    gc1.description = 'The grinder grinds coffee beans.';

MERGE (gc11:Goal {id: 'G_C1_1'})
SET gc11.name = 'LoadCoffeeBeans',
    gc11.category = 'subgoal',
    gc11.goalType = 'achieve',
    gc11.description = 'Ensure beans are available for grinding.';

MERGE (gc12:Goal {id: 'G_C1_2'})
SET gc12.name = 'ExecuteGrinding',
    gc12.category = 'subgoal',
    gc12.goalType = 'achieve',
    gc12.description = 'Run the grinder to produce ground coffee.';

MERGE (gc111:Goal {id: 'G_C1_1_1'})
SET gc111.name = 'CheckBeanAvailability',
    gc111.category = 'leaf',
    gc111.goalType = 'achieve',
    gc111.description = 'Check whether beans are available.';

MERGE (gc121:Goal {id: 'G_C1_2_1'})
SET gc121.name = 'StartGrindingMotor',
    gc121.category = 'leaf',
    gc121.goalType = 'achieve',
    gc121.description = 'Start the grinder motor.';

MERGE (gc122:Goal {id: 'G_C1_2_2'})
SET gc122.name = 'ProduceGroundCoffee',
    gc122.category = 'leaf',
    gc122.goalType = 'achieve',
    gc122.description = 'Produce ground coffee from beans.';

// REFINEMENT AND RESPONSIBILITY RELATIONS FOR GRINDER
MATCH
  (ac:Agent {id:'A_GRINDER'}),
  (gc1:Goal {id:'G_C1'}),
  (gc11:Goal {id:'G_C1_1'}),
  (gc12:Goal {id:'G_C1_2'}),
  (gc111:Goal {id:'G_C1_1_1'}),
  (gc121:Goal {id:'G_C1_2_1'}),
  (gc122:Goal {id:'G_C1_2_2'})
MERGE (gc1)-[:REFINES]->(gc11)
MERGE (gc1)-[:REFINES]->(gc12)
MERGE (gc11)-[:REFINES]->(gc111)
MERGE (gc12)-[:REFINES]->(gc121)
MERGE (gc12)-[:REFINES]->(gc122)
MERGE (gc1)-[:DELEGATED_TO]->(ac)
MERGE (gc11)-[:DELEGATED_TO]->(ac)
MERGE (gc12)-[:DELEGATED_TO]->(ac)
MERGE (gc111)-[:DELEGATED_TO]->(ac)
MERGE (gc121)-[:DELEGATED_TO]->(ac)
MERGE (gc122)-[:DELEGATED_TO]->(ac);

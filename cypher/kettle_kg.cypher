// =========================
// MERGE GOALS FOR KETTLE
// =========================
MERGE (ak:Agent {id: 'A_KETTLE'})
SET ak.name = 'KettleAgent';

MERGE (gk1:Goal {id: 'G_K1'})
SET gk1.name = 'ProvideHotWater',
    gk1.category = 'strategic',
    gk1.goalType = 'achieve',
    gk1.description = 'The kettle provides hot water.';

MERGE (gk11:Goal {id: 'G_K1_1'})
SET gk11.name = 'HeatWaterToTargetTemperature',
    gk11.category = 'subgoal',
    gk11.goalType = 'achieve',
    gk11.description = 'Heat water until it reaches the required target temperature.';

MERGE (gk12:Goal {id: 'G_K1_2'})
SET gk12.name = 'EnsureSufficientWaterVolume',
    gk12.category = 'subgoal',
    gk12.goalType = 'maintain',
    gk12.description = 'Measure water volume and ensure it is enough.';

MERGE (gk111:Goal {id: 'G_K1_1_1'})
SET gk111.name = 'ReachTargetTemperature',
    gk111.category = 'leaf',
    gk111.goalType = 'achieve',
    gk111.description = 'Raise water temperature until the target threshold is reached.';

MERGE (gk121:Goal {id: 'G_K1_2_1'})
SET gk121.name = 'DetectCurrentWaterLevel',
    gk121.category = 'leaf',
    gk121.goalType = 'achieve',
    gk121.description = 'Detect the current water level in the kettle.';

MERGE (gk122:Goal {id: 'G_K1_2_2'})
SET gk122.name = 'VerifyWaterVolumeMeetsDemand',
    gk122.category = 'leaf',
    gk122.goalType = 'achieve',
    gk122.description = 'Verify that the water volume satisfies the requested demand.';

// REFINEMENT AND RESPONSIBILITY RELATIONS FOR KETTLE
MATCH
  (ak:Agent {id:'A_KETTLE'}),
  (gk1:Goal {id:'G_K1'}),
  (gk11:Goal {id:'G_K1_1'}),
  (gk12:Goal {id:'G_K1_2'}),
  (gk111:Goal {id:'G_K1_1_1'}),
  (gk121:Goal {id:'G_K1_2_1'}),
  (gk122:Goal {id:'G_K1_2_2'})
MERGE (gk1)-[:REFINES]->(gk11)
MERGE (gk1)-[:REFINES]->(gk12)
MERGE (gk11)-[:REFINES]->(gk111)
MERGE (gk12)-[:REFINES]->(gk121)
MERGE (gk12)-[:REFINES]->(gk122)
MERGE (gk1)-[:DELEGATED_TO]->(ak)
MERGE (gk11)-[:DELEGATED_TO]->(ak)
MERGE (gk12)-[:DELEGATED_TO]->(ak)
MERGE (gk111)-[:DELEGATED_TO]->(ak)
MERGE (gk121)-[:DELEGATED_TO]->(ak)
MERGE (gk122)-[:DELEGATED_TO]->(ak);

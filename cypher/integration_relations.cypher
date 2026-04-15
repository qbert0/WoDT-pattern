// =========================
// MERGE INTEGRATION RELATIONS
// =========================

// SYSTEM GOALS DEPEND ON SUBSYSTEM GOALS
MATCH
  (gs1:Goal {id:'G_S1'}),
  (gs11:Goal {id:'G_S1_1'}),
  (gs12:Goal {id:'G_S1_2'}),
  (gs13:Goal {id:'G_S1_3'}),
  (gk1:Goal {id:'G_K1'}),
  (gc1:Goal {id:'G_C1'})
MERGE (gs1)-[:DEPENDS_ON]->(gk1)
MERGE (gs1)-[:DEPENDS_ON]->(gc1)
MERGE (gs11)-[:DEPENDS_ON]->(gk1)
MERGE (gs12)-[:DEPENDS_ON]->(gc1)
MERGE (gs13)-[:DEPENDS_ON]->(gk1)
MERGE (gs13)-[:DEPENDS_ON]->(gc1);

// SIMPLE CROSS-DT DEPENDENCY
MATCH
  (gk12:Goal {id:'G_K1_2'}),
  (gc11:Goal {id:'G_C1_1'}),
  (gc12:Goal {id:'G_C1_2'})
MERGE (gc11)-[:DEPENDS_ON]->(gk12)
MERGE (gc12)-[:DEPENDS_ON]->(gk12)
MERGE (gk12)-[:COORDINATES_WITH]->(gc11);

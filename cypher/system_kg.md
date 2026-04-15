// =========================
// SYSTEM AGENT
// =========================
MERGE (as:Agent {id: 'A_SYSTEM'})
SET as.name = 'SystemCoordinatorAgent';


// =========================
// SYSTEM GOALS
// =========================

// Root
MERGE (sys_root:Goal {id: 'G_SYSTEM_ROOT'})
SET sys_root.name = 'MakeCoffee',
    sys_root.description = 'Một cốc cà phê sẵn sàng';

// Cấp 2
MERGE (gs11:Goal {id: 'G_S1_1'})
SET gs11.name = 'HotWaterAvailable',
    gs11.description = 'Nước nóng sẵn sàng';

MERGE (gs12:Goal {id: 'G_S1_2'})
SET gs12.name = 'GroundCoffeeAvailable',
    gs12.description = 'Cà phê xay sẵn sàng';

MERGE (gs13:Goal {id: 'G_S1_3'})
SET gs13.name = 'CoffeeReady',
    gs13.description = 'Cà phê đã được pha xong';


// =========================
// GOAL REFINEMENT
// =========================

// MakeCoffee -> HotWaterAvailable + GroundCoffeeAvailable + CoffeeReady = AND
MATCH (root:Goal {id:'G_SYSTEM_ROOT'}),
      (g1:Goal {id:'G_S1_1'}),
      (g2:Goal {id:'G_S1_2'}),
      (g3:Goal {id:'G_S1_3'})
MERGE (root)-[r1:REFINES]->(g1)
SET r1.type = 'AND'

MERGE (root)-[r2:REFINES]->(g2)
SET r2.type = 'AND'

MERGE (root)-[r3:REFINES]->(g3)
SET r3.type = 'AND';


// =========================
// DELEGATION
// =========================

// Root goal delegated to system coordinator
MATCH (root:Goal {id:'G_SYSTEM_ROOT'}),
      (as:Agent {id:'A_SYSTEM'})
MERGE (root)-[:DELEGATED_TO]->(as);
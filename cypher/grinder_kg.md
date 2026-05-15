// =========================
// GRINDER AGENT
// =========================
MERGE (ag:Agent {id: 'A_GRINDER'})
SET ag.name = 'GrinderAgent';


// =========================
// GRINDER GOALS
// =========================

// Root goal
MERGE (gr_root:Goal {id: 'G_GRINDER_ROOT'})
SET gr_root.name = 'ProvideGroundCoffee',
    gr_root.description = 'Cung cấp cà phê đã xay theo yêu cầu';

// Cấp 2
MERGE (gc1:Goal {id: 'G_G1'})
SET gc1.name = 'GrindCoffeeBeans',
    gc1.description = 'Xay hạt cà phê để tạo bột cà phê';

MERGE (gc2:Goal {id: 'G_G2'})
SET gc2.name = 'EnsureRequiredBeanAmount',
    gc2.description = 'Đảm bảo lượng hạt cà phê đáp ứng yêu cầu xay';


// =========================
// GOAL REFINEMENT
// =========================
MATCH (root:Goal {id:'G_GRINDER_ROOT'}),
      (gc1:Goal {id:'G_G1'}),
      (gc2:Goal {id:'G_G2'})
MERGE (root)-[:REFINES {type:'AND'}]->(gc1)
MERGE (root)-[:REFINES {type:'AND'}]->(gc2);


// =========================
// DELEGATED_TO
// =========================
MATCH (root:Goal {id:'G_GRINDER_ROOT'}),
      (ag:Agent {id:'A_GRINDER'})
MERGE (root)-[:DELEGATED_TO]->(ag);


// =========================
// GRINDER TASKS
// =========================
MERGE (tg1:Task {id: 'T_G1'})
SET tg1.name = 'Grind',
    tg1.command = 'GRIND',
    tg1.inputParameters = '',
    tg1.outputParameters = 'grindComplete: boolean';

MERGE (tg2:Task {id: 'T_G2'})
SET tg2.name = 'SetBeanAmount',
    tg2.command = 'SET_BEAN_AMOUNT',
    tg2.inputParameters = 'amount: float',
    tg2.outputParameters = 'targetAmount: float';


// =========================
// OPERATIONALIZATION
// =========================

// GrindCoffeeBeans <- Grind
MATCH (gc1:Goal {id:'G_G1'}),
      (tg1:Task {id:'T_G1'})
MERGE (gc1)-[:OPERATIONALIZED_BY]->(tg1);

// EnsureRequiredBeanAmount <- SetBeanAmount
MATCH (gc2:Goal {id:'G_G2'}),
      (tg2:Task {id:'T_G2'})
MERGE (gc2)-[:OPERATIONALIZED_BY]->(tg2);
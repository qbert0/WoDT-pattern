MERGE (ag:Agent {id: 'A_GRINDER'})
SET ag.name = 'GrinderAgent';

MERGE (gr_root:Goal {id: 'G_GRINDER_ROOT'})
SET gr_root.name = 'GrinderFunctionality',
    gr_root.description = 'Xay nhuyen hat ca phe';

MERGE (gc1:Goal {id: 'G_C1'})
SET gc1.name = 'ProvideGroundCoffee',
    gc1.description = 'Cung cap ca phe da xay';

MERGE (gc11:Goal {id: 'G_C1_1'})
SET gc11.name = 'GrindCoffeeBeans',
    gc11.description = 'Xay hat ca phe';

MERGE (gc12:Goal {id: 'G_C1_2'})
SET gc12.name = 'DispenseBeans',
    gc12.description = 'Lay hat ca phe tu kho chua';

MATCH (root:Goal {id:'G_GRINDER_ROOT'}), (gc1:Goal {id:'G_C1'})
MERGE (root)-[:REFINES]->(gc1);

MATCH (gc1:Goal {id:'G_C1'}), (gc11:Goal {id:'G_C1_1'}), (gc12:Goal {id:'G_C1_2'})
MERGE (gc1)-[:REFINES]->(gc11)
MERGE (gc1)-[:REFINES]->(gc12);

MATCH (root:Goal {id:'G_GRINDER_ROOT'}), (ag:Agent {id:'A_GRINDER'})
MERGE (root)-[:DELEGATED_TO]->(ag);

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

MATCH (gc11:Goal {id:'G_C1_1'}), (tg1:Task {id:'T_G1'})
MERGE (gc11)-[:OPERATIONALIZED_BY]->(tg1);

MATCH (gc12:Goal {id:'G_C1_2'}), (tg2:Task {id:'T_G2'})
MERGE (gc12)-[:OPERATIONALIZED_BY]->(tg2);

MATCH (tg1:Task {id:'T_G1'}), (tg2:Task {id:'T_G2'})
MERGE (tg1)-[:DEPENDS_ON]->(tg2);

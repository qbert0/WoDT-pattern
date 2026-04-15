// =========================
// KETTLE AGENT
// =========================
MERGE (ak:Agent {id: 'A_KETTLE'})
SET ak.name = 'KettleAgent';


// =========================
// KETTLE GOALS
// =========================
MERGE (gk_root:Goal {id: 'G_KETTLE_ROOT'})
SET gk_root.name = 'ControlThermalOutput',
    gk_root.description = 'Dieu khien trang thai nhiet cua am dun nuoc';

MERGE (gk1:Goal {id: 'G_K1'})
SET gk1.name = 'IncreaseWaterTemperature',
    gk1.description = 'Tang nhiet do nuoc theo yeu cau';

MERGE (gk2:Goal {id: 'G_K2'})
SET gk2.name = 'DecreaseWaterTemperature',
    gk2.description = 'Giam hoac dung qua trinh gia nhiet cua nuoc';

MERGE (gk11:Goal {id: 'G_K1_1'})
SET gk11.name = 'HeatWaterToTargetTemperature',
    gk11.description = 'Dun nuoc den nhiet do muc tieu';

MERGE (gk12:Goal {id: 'G_K1_2'})
SET gk12.name = 'EnsureSufficientWaterVolume',
    gk12.description = 'Dam bao luong nuoc du theo yeu cau truoc hoac trong khi dun';


// =========================
// GOAL REFINEMENT
// =========================
MATCH (root:Goal {id:'G_KETTLE_ROOT'}),
      (gk1:Goal {id:'G_K1'}),
      (gk2:Goal {id:'G_K2'})
MERGE (root)-[r1:REFINES]->(gk1)
SET r1.type = 'OR';

MERGE (root)-[r2:REFINES]->(gk2)
SET r2.type = 'OR';

MATCH (gk1:Goal {id:'G_K1'}),
      (gk11:Goal {id:'G_K1_1'}),
      (gk12:Goal {id:'G_K1_2'})
MERGE (gk1)-[r3:REFINES]->(gk11)
SET r3.type = 'AND';

MERGE (gk1)-[r4:REFINES]->(gk12)
SET r4.type = 'AND';


// =========================
// DELEGATION
// =========================
MATCH (root:Goal {id:'G_KETTLE_ROOT'}),
      (ak:Agent {id:'A_KETTLE'})
MERGE (root)-[:DELEGATED_TO]->(ak);


// =========================
// KETTLE TASKS
// =========================
MERGE (tk1:Task {id: 'T_K1'})
SET tk1.name = 'TurnOn',
    tk1.command = 'TURN_ON',
    tk1.inputParameters = '',
    tk1.outputParameters = 'powerState: boolean';

MERGE (tk2:Task {id: 'T_K2'})
SET tk2.name = 'TurnOff',
    tk2.command = 'TURN_OFF',
    tk2.inputParameters = '',
    tk2.outputParameters = 'powerState: boolean';

MERGE (tk3:Task {id: 'T_K3'})
SET tk3.name = 'SetTargetTemperature',
    tk3.command = 'SET_TEMP',
    tk3.inputParameters = 'temperature: float',
    tk3.outputParameters = 'targetTemp: float';

MERGE (tk4:Task {id: 'T_K4'})
SET tk4.name = 'SetWaterVolume',
    tk4.command = 'SET_VOLUME',
    tk4.inputParameters = 'volume: float',
    tk4.outputParameters = 'targetVolume: float';


// =========================
// OPERATIONALIZATION
// =========================
MATCH (gk11:Goal {id:'G_K1_1'}),
      (tk1:Task {id:'T_K1'})
MERGE (gk11)-[:OPERATIONALIZED_BY]->(tk1);

MATCH (gk11:Goal {id:'G_K1_1'}),
      (tk3:Task {id:'T_K3'})
MERGE (gk11)-[:OPERATIONALIZED_BY]->(tk3);

MATCH (gk12:Goal {id:'G_K1_2'}),
      (tk4:Task {id:'T_K4'})
MERGE (gk12)-[:OPERATIONALIZED_BY]->(tk4);

MATCH (gk2:Goal {id:'G_K2'}),
      (tk2:Task {id:'T_K2'})
MERGE (gk2)-[:OPERATIONALIZED_BY]->(tk2);
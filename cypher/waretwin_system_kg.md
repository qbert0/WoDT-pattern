// =========================
// WARETWIN SYSTEM AGENT
// =========================
// Agent đại diện cho DT tổng hợp `waretwin:warehouse`.
// Lưu ý: khác mẫu coffee (system không có Task), WareTwin gộp "điều phối kho"
// và "Fleet Manager" làm một nên system sở hữu task phân đơn và thu thập năng lượng đội xe.
MERGE (aw:Agent {id: 'A_WARETWIN'})
SET aw.name = 'WarehouseCoordinatorAgent',
    aw.thingId = 'waretwin:warehouse',
    aw.thingIds = ['waretwin:warehouse'],
    aw.taskThingPattern = 'waretwin:task-*';


// =========================
// WARETWIN SYSTEM GOALS
// =========================

// Root goal
MERGE (gw_root:Goal {id: 'G_WT_FULFILL_OPERATIONS'})
SET gw_root.name = 'FulfillWarehouseOperations',
    gw_root.description = 'Vận hành kho: hoàn thành đơn hàng, an toàn, hiệu quả năng lượng và duy trì hạ tầng';

// Cấp 2
MERGE (gw_transport:Goal {id: 'G_WT_TRANSPORT'})
SET gw_transport.name = 'TransportGoods',
    gw_transport.description = 'Vận chuyển hàng hóa giữa các điểm trong kho';

MERGE (gw_xfloor:Goal {id: 'G_WT_CROSSFLOOR'})
SET gw_xfloor.name = 'EnsureCrossFloorFlow',
    gw_xfloor.description = 'Đảm bảo luồng hàng liên tầng qua thang máy';

MERGE (gw_safety:Goal {id: 'G_WT_SAFETY'})
SET gw_safety.name = 'EnsureOperationalSafety',
    gw_safety.description = 'Không va chạm, cách ly khu vực nguy hiểm, an toàn cho người';

MERGE (gw_energy:Goal {id: 'G_WT_ENERGY'})
SET gw_energy.name = 'MaintainFleetEnergy',
    gw_energy.description = 'Duy trì pin đội xe trong ngưỡng vận hành';

MERGE (gw_infra:Goal {id: 'G_WT_INFRA'})
SET gw_infra.name = 'MaintainInfrastructureAvailability',
    gw_infra.description = 'Duy trì băng tải, camera, cảm biến và trạm sạc khả dụng';

MERGE (gw_alloc:Goal {id: 'G_WT_ALLOC'})
SET gw_alloc.name = 'AllocateOrders',
    gw_alloc.description = 'Sinh và phân bổ đơn hàng cho đội robot theo loại/ưu tiên';


// =========================
// GOAL REFINEMENT
// REFINES chỉ phân rã trong cùng agent. Goal giao agent khác dùng DEPENDS_ON.
// =========================
MATCH (root:Goal {id:'G_WT_FULFILL_OPERATIONS'}),
      (g3:Goal {id:'G_WT_SAFETY'}),
      (g4:Goal {id:'G_WT_ENERGY'}),
      (g5:Goal {id:'G_WT_INFRA'}),
      (g6:Goal {id:'G_WT_ALLOC'})
MERGE (root)-[r3:REFINES]->(g3)
SET r3.type = 'AND'
MERGE (root)-[r4:REFINES]->(g4)
SET r4.type = 'AND'
MERGE (root)-[r5:REFINES]->(g5)
SET r5.type = 'AND'
MERGE (root)-[r6:REFINES]->(g6)
SET r6.type = 'AND';

// Các goal con cùng agent vẫn dùng REFINES, kể cả khi nằm ở file khác.
UNWIND [
  {parentId: 'G_WT_TRANSPORT', childId: 'G_R_EXECUTE_TRANSPORT'},
  {parentId: 'G_WT_CROSSFLOOR', childId: 'G_LT_PROVIDE_VERTICAL_TRANSPORT'},
  {parentId: 'G_WT_CROSSFLOOR', childId: 'G_LT_GATE'},
  {parentId: 'G_WT_TRANSPORT', childId: 'G_R_ENERGY'}
] AS refinement
MATCH (parent:Goal {id: refinement.parentId}), (child:Goal {id: refinement.childId})
MERGE (parent)-[r:REFINES]->(child)
SET r.type = 'AND';

// Ranh giới trách nhiệm: goal cha phụ thuộc goal được giao cho agent khác.
UNWIND [
  {parentId: 'G_WT_FULFILL_OPERATIONS', childId: 'G_WT_TRANSPORT'},
  {parentId: 'G_WT_FULFILL_OPERATIONS', childId: 'G_WT_CROSSFLOOR'},
  {parentId: 'G_WT_SAFETY', childId: 'G_Z_MAINTAIN_SAFE_TRAFFIC'},
  {parentId: 'G_WT_SAFETY', childId: 'G_P_PROVIDE_SITUATIONAL_AWARENESS'},
  {parentId: 'G_WT_INFRA', childId: 'G_CV_PROVIDE_MATERIAL_FLOW'}
] AS dependency
MATCH (parent:Goal {id: dependency.parentId}), (child:Goal {id: dependency.childId})
MERGE (parent)-[:DEPENDS_ON {type: 'ACHIEVED'}]->(child)
WITH parent, child
OPTIONAL MATCH (parent)-[obsolete:REFINES]->(child)
DELETE obsolete;


// MaintainFleetEnergy chỉ thu thập thông tin, không chứa nhánh duy trì pin Robot.
MATCH (:Goal {id:'G_WT_ENERGY'})-[obsolete:REFINES]->(:Goal {id:'G_R_ENERGY'})
DELETE obsolete;


// =========================
// DELEGATION
// =========================
MATCH (root:Goal {id:'G_WT_FULFILL_OPERATIONS'}),
      (aw:Agent {id:'A_WARETWIN'})
MERGE (root)-[:DELEGATED_TO]->(aw);

// Robot nhận TransportGoods, Lift nhận EnsureCrossFloorFlow, Conveyor nhận goal gốc thành phần.
// Các goal bên dưới kế thừa trách nhiệm từ goal được giao.
UNWIND [
  {goalId: 'G_WT_ENERGY', agentId: 'A_ROBOT'},
  {goalId: 'G_WT_INFRA', agentId: 'A_CONVEYOR'}
] AS assignment
MATCH (:Goal {id: assignment.goalId})-[obsolete:DELEGATED_TO]->(:Agent {id: assignment.agentId})
DELETE obsolete;

// Một điểm phân công duy nhất cho vận chuyển hàng và duy trì pin Robot.
MATCH (transport:Goal {id:'G_WT_TRANSPORT'}), (robot:Agent {id:'A_ROBOT'})
MERGE (transport)-[:DELEGATED_TO]->(robot);

// Một điểm phân công duy nhất cho cả vận chuyển liên tầng và an toàn cửa.
MATCH (crossfloor:Goal {id:'G_WT_CROSSFLOOR'}), (lift:Agent {id:'A_LIFT'})
MERGE (crossfloor)-[:DELEGATED_TO]->(lift);


// =========================
// ORDER TASKS (AllocateOrders)
// =========================
MERGE (to1:Task {id: 'T_ORDER_PICK'})
SET to1.name = 'CreatePickOrder',
    to1.command = 'PICK',
    to1.inputParameters = '',
    to1.outputParameters = 'taskId: string, load_units: int';

MERGE (to2:Task {id: 'T_ORDER_TRANSPORT'})
SET to2.name = 'CreateTransportOrder',
    to2.command = 'TRANSPORT',
    to2.inputParameters = '',
    to2.outputParameters = 'taskId: string, load_units: int';

MERGE (to3:Task {id: 'T_ORDER_REPLENISH'})
SET to3.name = 'CreateReplenishOrder',
    to3.command = 'REPLENISH',
    to3.inputParameters = '',
    to3.outputParameters = 'taskId: string, load_units: int';

MERGE (to4:Task {id: 'T_ORDER_RETURN'})
SET to4.name = 'CreateReturnOrder',
    to4.command = 'RETURN',
    to4.inputParameters = '',
    to4.outputParameters = 'taskId: string, load_units: int';


// =========================
// FLEET ENERGY TASK
// =========================
// Task ở mức KG: thu thập thông tin năng lượng của đội robot.
MERGE (collectEnergy:Task {id: 'T_FLEET_COLLECT_ENERGY'})
SET collectEnergy.name = 'CollectRobotEnergyInformation',
    collectEnergy.command = 'COLLECT_ROBOT_ENERGY_INFORMATION',
    collectEnergy.inputParameters = '',
    collectEnergy.outputParameters = 'robot_energy: array';


// =========================
// OPERATIONALIZATION
// =========================
MATCH (gw_alloc:Goal {id:'G_WT_ALLOC'}), (to1:Task {id:'T_ORDER_PICK'})
MERGE (gw_alloc)-[:OPERATIONALIZED_BY]->(to1);

MATCH (gw_alloc:Goal {id:'G_WT_ALLOC'}), (to2:Task {id:'T_ORDER_TRANSPORT'})
MERGE (gw_alloc)-[:OPERATIONALIZED_BY]->(to2);

MATCH (gw_alloc:Goal {id:'G_WT_ALLOC'}), (to3:Task {id:'T_ORDER_REPLENISH'})
MERGE (gw_alloc)-[:OPERATIONALIZED_BY]->(to3);

MATCH (gw_alloc:Goal {id:'G_WT_ALLOC'}), (to4:Task {id:'T_ORDER_RETURN'})
MERGE (gw_alloc)-[:OPERATIONALIZED_BY]->(to4);

MATCH (energy:Goal {id:'G_WT_ENERGY'}), (collectEnergy:Task {id:'T_FLEET_COLLECT_ENERGY'})
MERGE (energy)-[:OPERATIONALIZED_BY]->(collectEnergy);

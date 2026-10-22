// =========================
// WARETWIN INTEGRATION RELATIONS
// =========================
// Chạy sau các file *_kg.md. REFINES chỉ nằm trong phạm vi cùng agent.
// DEPENDS_ON nối goal thuộc agent khác và biểu diễn điều kiện phối hợp/truyền tham số.

// Bỏ ba phụ thuộc ACHIEVED cũ. Infra -> Conveyor là khác agent nên phải giữ.
// Transport/CrossFloor phân rã nội bộ, FleetEnergy dùng task thu thập thông tin.
UNWIND [
  {parentId: 'G_WT_TRANSPORT', childId: 'G_R_EXECUTE_TRANSPORT'},
  {parentId: 'G_WT_CROSSFLOOR', childId: 'G_LT_PROVIDE_VERTICAL_TRANSPORT'},
  {parentId: 'G_WT_ENERGY', childId: 'G_R_ENERGY'}
] AS refinement
MATCH (:Goal {id: refinement.parentId})-[obsolete:DEPENDS_ON]->(:Goal {id: refinement.childId})
WHERE obsolete.type = 'ACHIEVED'
DELETE obsolete;

// Có đơn trước đã rồi mới vận chuyển
MATCH (s:Goal {id:'G_WT_TRANSPORT'}), (t:Goal {id:'G_WT_ALLOC'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'Vận chuyển hàng cần Fleet Manager đã phân bổ đơn (AllocateOrders)';


// =========================
// DT-TO-DT DEPENDENCIES (ACHIEVED)
// =========================

// Robot đi liên tầng cần thang máy (leaf goal -> component root)
MATCH (s:Goal {id:'G_R_NAVIGATE'}), (t:Goal {id:'G_LT_PROVIDE_VERTICAL_TRANSPORT'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'Định tuyến liên tầng phụ thuộc LiftAgent đưa robot sang tầng đích';

// Robot tránh va chạm dựa trên khả năng phát hiện nguy hiểm của Perception.
// Đây là phụ thuộc phối hợp, không phân rã lại goal hoặc đổi Agent phụ trách.
MATCH (s:Goal {id:'G_R_SAFE'}), (t:Goal {id:'G_P_DETECT'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'Tránh va chạm phụ thuộc vào khả năng phát hiện nguy hiểm của PerceptionAgent';

// Zone chặn khi nguy hiểm phụ thuộc phát hiện của perception
MATCH (s:Goal {id:'G_Z_BLOCK'}), (t:Goal {id:'G_P_DETECT'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'Chặn zone dựa trên kết quả phát hiện người/vật cản của VLM';


// =========================
// RECHARGE -> REACH CHARGER
// =========================
// Biểu diễn một lần ở mức goal, cùng dạng depends_on trong model Robot.
MATCH (:Task {id:'T_R_RECHARGE'})-[obsolete:DEPENDS_ON]->(:Task {id:'T_R_CHARGE'})
WHERE obsolete.type = 'EXECUTION'
DELETE obsolete;

MATCH (recharge:Goal {id:'G_R_RECHARGE'}), (reach:Goal {id:'G_R_REACH'})
MERGE (recharge)-[r:DEPENDS_ON {type: 'ACHIEVED'}]->(reach)
SET r.type = 'ACHIEVED',
    r.description = 'Chỉ sạc được sau khi đã cập bến trạm sạc';


// =========================
// TASK -> TASK (PARAMETER)
// =========================
// Bỏ ánh xạ ngược: tầng thực tế của Lift không phải tầng đích yêu cầu của Navigate.
MATCH (:Task {id:'T_R_NAVIGATE'})-[obsolete:DEPENDS_ON]->(:Task {id:'T_LIFT_SERVE'})
WHERE obsolete.type = 'PARAMETER'
DELETE obsolete;

// Lift nhận tầng đích từ REQUEST Navigate, không đợi Navigate hoàn thành.
MATCH (tr_nav:Task {id:'T_R_NAVIGATE'}), (tl_serve:Task {id:'T_LIFT_SERVE'})
MERGE (tl_serve)-[r:DEPENDS_ON {type: 'PARAMETER'}]->(tr_nav)
SET r.type = 'PARAMETER',
    r.sourceParameter = 'target_floor',
    r.targetParameter = 'target_floor',
    r.sourcePhase = 'REQUEST',
    r.factor = 1.0,
    r.offset = 0.0,
    r.description = 'Lift nhận tầng đích từ yêu cầu Navigate cùng robot và lift request';

// load_units của Drop lấy từ Pick (giữ nguyên tải khi giao)
MATCH (tr_drop:Task {id:'T_R_DROP'}), (tr_pick:Task {id:'T_R_PICK'})
MERGE (tr_drop)-[r:DEPENDS_ON]->(tr_pick)
SET r.type = 'PARAMETER',
    r.sourceParameter = 'load_units',
    r.targetParameter = 'load_units',
    r.factor = 1.0,
    r.offset = 0.0,
    r.description = 'Lượng hàng giao bằng lượng hàng đã lấy';

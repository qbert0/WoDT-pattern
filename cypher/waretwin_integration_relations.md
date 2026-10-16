// =========================
// WARETWIN INTEGRATION RELATIONS
// =========================
// Chạy sau các file *_kg.md. System nối cây thành phần bằng REFINES.
// DEPENDS_ON chỉ biểu diễn điều kiện phối hợp và truyền tham số/thứ tự thực thi.
// Giữ nguyên nhánh EnsureOperationalSafety và các phụ thuộc của Zone/Perception.

// Bỏ bốn phụ thuộc ACHIEVED cũ của system.
// Transport/CrossFloor/Infra dùng REFINES, FleetEnergy dùng task thu thập thông tin.
UNWIND [
  {parentId: 'G_WT_TRANSPORT', childId: 'G_R_EXECUTE_TRANSPORT'},
  {parentId: 'G_WT_CROSSFLOOR', childId: 'G_LT_PROVIDE_VERTICAL_TRANSPORT'},
  {parentId: 'G_WT_ENERGY', childId: 'G_R_ENERGY'},
  {parentId: 'G_WT_INFRA', childId: 'G_CV_PROVIDE_MATERIAL_FLOW'}
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
// TASK -> TASK (EXECUTION)
// =========================
// Recharge cần đã tới trạm sạc
MATCH (tr_recharge:Task {id:'T_R_RECHARGE'}), (tr_reach:Task {id:'T_R_CHARGE'})
MERGE (tr_recharge)-[r:DEPENDS_ON]->(tr_reach)
SET r.type = 'EXECUTION',
    r.description = 'Chỉ sạc được sau khi đã cập bến trạm sạc';


// =========================
// TASK -> TASK (PARAMETER)
// =========================
// target_floor của Navigate lấy từ floor do Lift cấp
MATCH (tr_nav:Task {id:'T_R_NAVIGATE'}), (tl_serve:Task {id:'T_LIFT_SERVE'})
MERGE (tr_nav)-[r:DEPENDS_ON]->(tl_serve)
SET r.type = 'PARAMETER',
    r.sourceParameter = 'floor',
    r.targetParameter = 'target_floor',
    r.factor = 1.0,
    r.offset = 0.0,
    r.description = 'Tầng đích khi định tuyến lấy từ tầng mà thang máy phục vụ';

// load_units của Drop lấy từ Pick (giữ nguyên tải khi giao)
MATCH (tr_drop:Task {id:'T_R_DROP'}), (tr_pick:Task {id:'T_R_PICK'})
MERGE (tr_drop)-[r:DEPENDS_ON]->(tr_pick)
SET r.type = 'PARAMETER',
    r.sourceParameter = 'load_units',
    r.targetParameter = 'load_units',
    r.factor = 1.0,
    r.offset = 0.0,
    r.description = 'Lượng hàng giao bằng lượng hàng đã lấy';

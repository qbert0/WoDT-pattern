// =========================
// WARETWIN INTEGRATION RELATIONS
// =========================
// Phụ thuộc giữa system và các DT thành phần, giữa các DT với nhau,
// và giữa các Task (parameter/execution). Chạy SAU tất cả file *_kg.md.
//
// Quy ước (theo casestudy): DEPENDS_ON chỉ dùng cho leaf goal → leaf goal,
// hoặc task → task. System leaf goal KHÔNG có REFINES con.

// =========================
// SYSTEM LEAF -> COMPONENT ROOT (ACHIEVED)
// =========================

// Vận chuyển hàng cần robot thực thi nhiệm vụ
MATCH (s:Goal {id:'G_WT_TRANSPORT'}), (t:Goal {id:'G_ROBOT_ROOT'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'Luồng vận chuyển hàng đạt được khi RobotAgent hoàn thành nhiệm vụ';

// Luồng liên tầng cần thang máy
MATCH (s:Goal {id:'G_WT_CROSSFLOOR'}), (t:Goal {id:'G_LIFT_ROOT'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'Hàng liên tầng chỉ thông khi LiftAgent phục vụ được yêu cầu';

// An toàn cần zone + perception
MATCH (s:Goal {id:'G_WT_SAFETY'}), (t:Goal {id:'G_ZONE_ROOT'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'An toàn vận hành cần ZoneAgent duy trì giao thông an toàn';

MATCH (s:Goal {id:'G_WT_SAFETY'}), (t:Goal {id:'G_PERCEPTION_ROOT'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'An toàn vận hành cần PerceptionAgent phát hiện nguy hiểm';

// Năng lượng cần nhánh MaintainBattery của robot
MATCH (s:Goal {id:'G_WT_ENERGY'}), (t:Goal {id:'G_R_ENERGY'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'Duy trì năng lượng đội xe cần RobotAgent giữ pin trên ngưỡng';

// Hạ tầng cần băng tải cấp hàng
MATCH (s:Goal {id:'G_WT_INFRA'}), (t:Goal {id:'G_CONV_ROOT'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'Khả dụng hạ tầng phụ thuộc ConveyorAgent cấp hàng cho trạm';

// Có đơn trước đã rồi mới vận chuyển
MATCH (s:Goal {id:'G_WT_TRANSPORT'}), (t:Goal {id:'G_WT_ALLOC'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'Vận chuyển hàng cần Fleet Manager đã phân bổ đơn (AllocateOrders)';


// =========================
// DT-TO-DT DEPENDENCIES (ACHIEVED)
// =========================

// Robot đi liên tầng cần thang máy (leaf goal -> component root)
MATCH (s:Goal {id:'G_R_NAVIGATE'}), (t:Goal {id:'G_LIFT_ROOT'})
MERGE (s)-[r:DEPENDS_ON]->(t)
SET r.type = 'ACHIEVED',
    r.description = 'Định tuyến liên tầng phụ thuộc LiftAgent đưa robot sang tầng đích';

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

// =========================
// WARETWIN ROBOT AGENT
// Goal conditions and dependency bindings: ../goal_model/waretwin_robot.json, applied by seed_neo4j.py.
// =========================
// Một Agent đại diện cho cả 20 AMR (waretwin:robot-R01..R20).
MERGE (ar:Agent {id: 'A_ROBOT'})
SET ar.name = 'RobotAgent',
    ar.thingIdPattern = 'waretwin:robot-*',
    ar.thingIds = ['waretwin:robot-R01','waretwin:robot-R02','waretwin:robot-R03','waretwin:robot-R04','waretwin:robot-R05',
                   'waretwin:robot-R06','waretwin:robot-R07','waretwin:robot-R08','waretwin:robot-R09','waretwin:robot-R10',
                   'waretwin:robot-R11','waretwin:robot-R12','waretwin:robot-R13','waretwin:robot-R14','waretwin:robot-R15',
                   'waretwin:robot-R16','waretwin:robot-R17','waretwin:robot-R18','waretwin:robot-R19','waretwin:robot-R20'];


// =========================
// ROBOT GOALS
// =========================

// Nhánh thực thi nhiệm vụ bên dưới TransportGoods
MERGE (gr_root:Goal {id: 'G_R_EXECUTE_TRANSPORT'})
SET gr_root.name = 'ExecuteTransportTasks',
    gr_root.type = 'Achieve',
    gr_root.description = 'Thực thi các nhiệm vụ vận chuyển được Fleet Manager giao';

// Nhánh vận chuyển
MERGE (gr_transport:Goal {id: 'G_R_TRANSPORT'})
SET gr_transport.name = 'TransportItem',
    gr_transport.type = 'Achieve',
    gr_transport.description = 'Lấy hàng tại nguồn và giao tới đích';

MERGE (gr_nav:Goal {id: 'G_R_NAVIGATE'})
SET gr_nav.name = 'NavigateToTarget',
    gr_nav.type = 'Achieve',
    gr_nav.description = 'Di chuyển theo tuyến A* tới điểm đích (cùng tầng hoặc qua thang máy)';

MERGE (gr_pick:Goal {id: 'G_R_PICK'})
SET gr_pick.name = 'PickLoad',
    gr_pick.type = 'Achieve',
    gr_pick.description = 'Lấy và xác nhận tải tại điểm nguồn';

MERGE (gr_drop:Goal {id: 'G_R_DROP'})
SET gr_drop.name = 'DeliverLoad',
    gr_drop.type = 'Achieve',
    gr_drop.description = 'Giao và dỡ tải tại điểm đích';

// Nhánh năng lượng
MERGE (gr_energy:Goal {id: 'G_R_ENERGY'})
SET gr_energy.name = 'MaintainBattery',
    gr_energy.type = 'Maintain',
    gr_energy.description = 'Duy trì pin trên ngưỡng an toàn để tiếp tục nhận nhiệm vụ';

MERGE (gr_reach:Goal {id: 'G_R_REACH'})
SET gr_reach.name = 'ReachCharger',
    gr_reach.type = 'Achieve',
    gr_reach.description = 'Di chuyển và cập bến một trạm sạc còn trống';

MERGE (gr_recharge:Goal {id: 'G_R_RECHARGE'})
SET gr_recharge.name = 'RechargeBattery',
    gr_recharge.type = 'Achieve',
    gr_recharge.description = 'Nạp pin tới ngưỡng vận hành';

// Robot phản ứng tránh va chạm dựa trên thông tin nguy hiểm từ Perception.
MERGE (gr_safe:Goal {id: 'G_R_SAFE'})
SET gr_safe.name = 'EnsureCollisionFreeOperation',
    gr_safe.type = 'Avoid',
    gr_safe.description = 'Tránh, dừng hoặc nhường đường dựa trên thông tin nguy hiểm';


// =========================
// GOAL REFINEMENT
// =========================

// ExecuteTransportTasks = AND (vận chuyển đồng thời bảo đảm tránh va chạm)
MATCH (root:Goal {id:'G_R_EXECUTE_TRANSPORT'}),
      (gt:Goal {id:'G_R_TRANSPORT'}),
      (gs:Goal {id:'G_R_SAFE'})
MERGE (root)-[r1:REFINES]->(gt)
SET r1.type = 'AND'
MERGE (root)-[r3:REFINES]->(gs)
SET r3.type = 'AND';

// TransportItem = AND
MATCH (gt:Goal {id:'G_R_TRANSPORT'}),
      (gn:Goal {id:'G_R_NAVIGATE'}),
      (gp:Goal {id:'G_R_PICK'}),
      (gd:Goal {id:'G_R_DROP'})
MERGE (gt)-[r1:REFINES]->(gn)
SET r1.type = 'AND'
MERGE (gt)-[r2:REFINES]->(gp)
SET r2.type = 'AND'
MERGE (gt)-[r3:REFINES]->(gd)
SET r3.type = 'AND';

// MaintainBattery = AND
MATCH (ge:Goal {id:'G_R_ENERGY'}),
      (gr:Goal {id:'G_R_REACH'}),
      (gc:Goal {id:'G_R_RECHARGE'})
MERGE (ge)-[r1:REFINES]->(gr)
SET r1.type = 'AND'
MERGE (ge)-[r2:REFINES]->(gc)
SET r2.type = 'AND';


// =========================
// DELEGATION
// =========================
// MaintainBattery được chuyển thành nhánh trực tiếp của TransportGoods.
MATCH (:Goal {id:'G_R_EXECUTE_TRANSPORT'})-[obsolete:REFINES]->(:Goal {id:'G_R_ENERGY'})
DELETE obsolete;

// RobotAgent chỉ nhận TransportGoods, được gán trong waretwin_system_kg.md.
// Bỏ phân công cũ ở các goal thành phần, kể cả nhánh năng lượng đã chuyển.
MATCH (goal:Goal)-[obsolete:DELEGATED_TO]->(:Agent {id:'A_ROBOT'})
WHERE goal.id IN ['G_R_EXECUTE_TRANSPORT', 'G_R_TRANSPORT', 'G_R_NAVIGATE', 'G_R_PICK', 'G_R_DROP',
                 'G_R_ENERGY', 'G_R_REACH', 'G_R_RECHARGE', 'G_R_SAFE']
DELETE obsolete;


// =========================
// ROBOT TASKS
// =========================
MERGE (tr1:Task {id: 'T_R_NAVIGATE'})
SET tr1.name = 'Navigate',
    tr1.command = 'NAVIGATE',
    tr1.inputParameters = 'target_x: float, target_z: float, target_floor: int',
    tr1.outputParameters = 'arrived: boolean',
    tr1.precondition = 'exists(Robot) AND Robot.fsm NOT IN ["OFFLINE", "ERROR"] AND Robot.battery > 0 AND input.target_floor IN layout.floors AND finite(input.target_x) AND finite(input.target_z) AND walkable_target(input.target_floor, input.target_x, input.target_z) AND (input.target_floor == Robot.floor OR lift_route_available(Robot, input.target_floor))',
    tr1.postcondition = 'at("NAVIGATION_COMPLETED") AND Robot.floor == input.target_floor AND destination_reached(Robot, input.target_floor, input.target_x, input.target_z) AND runtime.target == null AND runtime.pending == null AND Robot.velocity == 0';

MERGE (tr2:Task {id: 'T_R_PICK'})
SET tr2.name = 'Pick',
    tr2.command = 'PICK',
    tr2.inputParameters = '',
    tr2.outputParameters = 'load_units: int',
    tr2.precondition = 'exists(Task) AND Task.id == Robot.current_task_id AND Task.assigned_robot == Robot.id AND Task.status == "IN_PROGRESS" AND Robot.fsm == "PICKING" AND service_position(Robot, Task.source) AND Robot.load.current == 0 AND Task.load_units > 0 AND Task.load_units <= Robot.load.capacity',
    tr2.postcondition = 'at("PICK_COMPLETED") AND phase_ticks(before.Robot.id, "PICKING") >= SIM.PICK_TICKS AND Task.id == before.Task.id AND Task.assigned_robot == before.Robot.id AND Robot.current_task_id == before.Task.id AND Robot.load.current == before.Task.load_units AND Robot.fsm == "TRANSPORTING" AND event_seen("TASK_STARTED", {"task_id": before.Task.id, "robot_id": before.Robot.id})';

MERGE (tr3:Task {id: 'T_R_DROP'})
SET tr3.name = 'Drop',
    tr3.command = 'DROP',
    tr3.inputParameters = 'load_units: int',
    tr3.outputParameters = 'delivered: boolean',
    tr3.precondition = 'exists(Task) AND Task.id == Robot.current_task_id AND Task.assigned_robot == Robot.id AND Task.status == "IN_PROGRESS" AND Robot.fsm == "DELIVERING" AND service_position(Robot, Task.destination) AND Robot.load.current == Task.load_units AND input.load_units == Task.load_units',
    tr3.postcondition = 'at("DROP_COMPLETED") AND phase_ticks(before.Robot.id, "DELIVERING") >= SIM.DROP_TICKS * before.station_slowdown AND state.tasks[before.Task.id].status == "COMPLETED" AND state.tasks[before.Task.id].completed_tick == tick AND event_seen("TASK_COMPLETED", {"task_id": before.Task.id, "robot_id": before.Robot.id}) AND Robot.load.current == 0 AND Robot.current_task_id == null AND Robot.fsm == "COMPLETED"';

MERGE (tr4:Task {id: 'T_R_CHARGE'})
SET tr4.name = 'GoToCharger',
    tr4.command = 'GO_CHARGE',
    tr4.inputParameters = '',
    tr4.outputParameters = 'charger_id: string',
    tr4.precondition = 'Robot.fsm NOT IN ["OFFLINE", "ERROR"] AND Robot.battery > 0 AND Robot.current_task_id == null AND Robot.load.current == 0 AND ((Robot.fsm == "IDLE" AND Robot.battery < 35) OR transfer_completed(Robot.id)) AND any(c, layout.charging_stations, charger_busy[c.id] == null AND route_available(Robot, c.floor, c.access_point))',
    tr4.postcondition = 'at("CHARGER_DOCKED") AND Robot.fsm == "CHARGING" AND Robot.velocity == 0 AND runtime.target == null AND runtime.pending == null AND runtime.charger_id == output.charger_id AND charger_busy[output.charger_id] == before.Robot.id AND charger_docked(Robot, output.charger_id)';

MERGE (tr5:Task {id: 'T_R_RECHARGE'})
SET tr5.name = 'Recharge',
    tr5.command = 'RECHARGE',
    tr5.inputParameters = 'target_soc: float',
    tr5.outputParameters = 'battery: float',
    tr5.precondition = 'Robot.fsm == "CHARGING" AND Robot.velocity == 0 AND exists(runtime.charger_id) AND charger_busy[runtime.charger_id] == Robot.id AND input.target_soc == 95',
    tr5.postcondition = 'at("RECHARGE_COMPLETED") AND Robot.battery >= 95 AND Robot.battery <= 100 AND Robot.fsm == "IDLE" AND runtime.charger_id == null AND charger_busy[before.runtime.charger_id] == null AND output.battery == Robot.battery';

MERGE (tr6:Task {id: 'T_R_AVOID'})
SET tr6.name = 'AvoidObstacle',
    tr6.command = 'AVOID',
    tr6.inputParameters = 'obstacle_distance_m: float',
    tr6.outputParameters = 'path_cells: int',
    tr6.precondition = 'Robot.fsm NOT IN ["OFFLINE", "ERROR"] AND Robot.perception.state != "OFF" AND input.obstacle_distance_m >= 0 AND (path_obstructed(Robot) OR next_cell_occupied(Robot) OR Robot.fsm IN ["OBSTACLE_DETECTED", "REPLANNING"])',
    tr6.postcondition = 'at("AVOIDANCE_CHECKED") AND ((path_blocked(Robot) AND Robot.velocity == 0) OR (valid_detour(Robot, before.runtime) AND phase_resumed(Robot, before.runtime.phase))) AND safe_motion(Robot, before) AND Robot.velocity >= 0 AND Robot.velocity <= Robot.max_speed AND output.path_cells == size(Robot.path)';


// =========================
// OPERATIONALIZATION
// =========================
MATCH (gn:Goal {id:'G_R_NAVIGATE'}), (tr1:Task {id:'T_R_NAVIGATE'})
MERGE (gn)-[:OPERATIONALIZED_BY]->(tr1);

MATCH (gp:Goal {id:'G_R_PICK'}), (tr2:Task {id:'T_R_PICK'})
MERGE (gp)-[:OPERATIONALIZED_BY]->(tr2);

MATCH (gd:Goal {id:'G_R_DROP'}), (tr3:Task {id:'T_R_DROP'})
MERGE (gd)-[:OPERATIONALIZED_BY]->(tr3);

MATCH (gr:Goal {id:'G_R_REACH'}), (tr4:Task {id:'T_R_CHARGE'})
MERGE (gr)-[:OPERATIONALIZED_BY]->(tr4);

MATCH (gc:Goal {id:'G_R_RECHARGE'}), (tr5:Task {id:'T_R_RECHARGE'})
MERGE (gc)-[:OPERATIONALIZED_BY]->(tr5);

MATCH (gs:Goal {id:'G_R_SAFE'}), (tr6:Task {id:'T_R_AVOID'})
MERGE (gs)-[:OPERATIONALIZED_BY]->(tr6);

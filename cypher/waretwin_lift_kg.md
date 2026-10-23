// =========================
// WARETWIN LIFT AGENT
// =========================
// Một Agent đại diện cho cả 2 thang máy hàng (waretwin:lift-LIFT-1/2).
MERGE (al:Agent {id: 'A_LIFT'})
SET al.name = 'LiftAgent',
    al.thingIdPattern = 'waretwin:lift-*',
    al.thingIds = ['waretwin:lift-LIFT-1', 'waretwin:lift-LIFT-2'];


// =========================
// LIFT GOALS
// =========================

// Nhánh vận chuyển bên dưới EnsureCrossFloorFlow
MERGE (gl_root:Goal {id: 'G_LT_PROVIDE_VERTICAL_TRANSPORT'})
SET gl_root.name = 'ProvideVerticalTransport',
    gl_root.type = 'Achieve',
    gl_root.description = 'Chở robot giữa tầng 1 và tầng lửng an toàn, đúng thứ tự';

MERGE (gl_serve:Goal {id: 'G_LT_SERVE'})
SET gl_serve.name = 'ServeTransportRequest',
    gl_serve.type = 'Achieve',
    gl_serve.description = 'Phục vụ yêu cầu đi thang của robot (xếp hàng, mở cửa, di chuyển, hạ tải)';

MERGE (gl_queue:Goal {id: 'G_LT_QUEUE'})
SET gl_queue.name = 'QueueAndReserve',
    gl_queue.type = 'Achieve',
    gl_queue.description = 'Xếp hàng FIFO theo tầng và cấp quyền dùng thang';

MERGE (gl_gate:Goal {id: 'G_LT_GATE'})
SET gl_gate.name = 'EnsureSafeGateOperation',
    gl_gate.type = 'Avoid',
    gl_gate.description = 'Cửa/van an toàn: không bao giờ di chuyển khi cửa mở';

MERGE (gl_ride:Goal {id: 'G_LT_RIDE'})
SET gl_ride.name = 'MoveBetweenFloors',
    gl_ride.type = 'Achieve',
    gl_ride.description = 'Nâng/hạ khoang tới đúng tầng rồi san phẳng';

MERGE (gl_recover:Goal {id: 'G_LT_RECOVER'})
SET gl_recover.name = 'RecoverFromFault',
    gl_recover.type = 'Achieve',
    gl_recover.description = 'Xử lý sự cố: giữ khoang an toàn và cho robot định tuyến lại';


// =========================
// GOAL REFINEMENT
// =========================
MATCH (root:Goal {id:'G_LT_PROVIDE_VERTICAL_TRANSPORT'}),
      (gs:Goal {id:'G_LT_SERVE'}),
      (gr:Goal {id:'G_LT_RECOVER'})
MERGE (root)-[r1:REFINES]->(gs)
SET r1.type = 'OR'
MERGE (root)-[r2:REFINES]->(gr)
SET r2.type = 'OR';

MATCH (gs:Goal {id:'G_LT_SERVE'}),
      (gq:Goal {id:'G_LT_QUEUE'}),
      (gr:Goal {id:'G_LT_RIDE'})
MERGE (gs)-[r1:REFINES]->(gq)
SET r1.type = 'AND'
MERGE (gs)-[r3:REFINES]->(gr)
SET r3.type = 'AND';


// =========================
// DELEGATION
// =========================
// EnsureSafeGateOperation là nhánh trực tiếp của EnsureCrossFloorFlow.
// Bỏ cạnh cũ dưới ServeTransportRequest để không giữ hai vị trí phân rã.
MATCH (:Goal {id:'G_LT_SERVE'})-[obsolete:REFINES]->(:Goal {id:'G_LT_GATE'})
DELETE obsolete;

// LiftAgent chỉ nhận EnsureCrossFloorFlow, được gán trong waretwin_system_kg.md.
// Bỏ phân công cũ ở ProvideVerticalTransport và các goal con, kể cả goal cửa.
MATCH (goal:Goal)-[obsolete:DELEGATED_TO]->(:Agent {id:'A_LIFT'})
WHERE goal.id IN ['G_LT_PROVIDE_VERTICAL_TRANSPORT', 'G_LT_SERVE', 'G_LT_QUEUE', 'G_LT_GATE', 'G_LT_RIDE', 'G_LT_RECOVER']
DELETE obsolete;


// =========================
// LIFT TASKS
// =========================
MERGE (tl1:Task {id: 'T_LIFT_QUEUE'})
SET tl1.name = 'QueueForService',
    tl1.command = 'QUEUE',
    tl1.inputParameters = 'floor: int',
    tl1.outputParameters = 'queue_position: int',
    tl1.precondition = 'exists(Robot) AND exists(Lift) AND Lift.fault == false AND input.floor == Robot.floor AND input.floor IN lift_floors(Lift.id) AND exists(runtime.pending) AND runtime.pending.floor != Robot.floor AND runtime.lift_id == Lift.id AND lift_queue_position_reached(Robot, Lift)',
    tl1.postcondition = 'at("QUEUE_INSERTED") AND count(rid, Lift.queue[str(input.floor)], rid == before.Robot.id) == 1 AND Robot.lift_stage == "QUEUED" AND output.queue_position == index_of(Lift.queue[str(input.floor)], before.Robot.id)';

MERGE (tl2:Task {id: 'T_LIFT_GATE'})
SET tl2.name = 'ControlGate',
    tl2.command = 'CONTROL_GATE',
    tl2.inputParameters = 'action: string',
    tl2.outputParameters = 'gate_state: string',
    tl2.precondition = 'exists(Lift) AND Lift.fault == false AND input.action IN ["OPEN", "CLOSE"] AND ((input.action == "OPEN" AND lift_stopped_and_level(Lift) AND Lift.state IN ["DOOR_OPENING", "DOOR_OPENING_AT_DESTINATION"]) OR (input.action == "CLOSE" AND ((Lift.state == "DOOR_CLOSING" AND cabin_boarded(Lift)) OR (Lift.state == "DOOR_CLOSING_AFTER_EXIT" AND exit_clear(Lift)))))',
    tl2.postcondition = 'at("GATE_COMPLETED") AND phase_ticks(before.Lift.id, before.Lift.state) >= SIM.LIFT_DOOR_TICKS AND ((input.action == "OPEN" AND door(Lift, before.Lift.floor) == "OPEN" AND door(Lift, other_floor(before.Lift.floor)) == "CLOSED" AND Lift.state IN ["BOARDING", "ALIGHTING"]) OR (input.action == "CLOSE" AND Lift.door_f1 == "CLOSED" AND Lift.door_f2 == "CLOSED")) AND output.gate_state == door(Lift, before.Lift.floor)';

MERGE (tl3:Task {id: 'T_LIFT_SERVE'})
SET tl3.name = 'Serve',
    tl3.command = 'SERVE',
    tl3.inputParameters = 'target_floor: int',
    tl3.outputParameters = 'floor: int, occupant: string',
    tl3.precondition = 'Lift.fault == false AND Lift.occupant == Robot.id AND Robot.lift_stage == "RIDING" AND Lift.door_f1 == "CLOSED" AND Lift.door_f2 == "CLOSED" AND exists(runtime.pending) AND input.target_floor == runtime.pending.floor AND input.target_floor IN lift_floors(Lift.id) AND input.target_floor != Robot.floor',
    tl3.postcondition = 'at("LIFT_EXIT_COMPLETED") AND lift_exit_seen(before.Robot.id, before.Lift.id, input.target_floor) AND Robot.floor == input.target_floor AND Robot.lift_id == null AND Robot.lift_stage == null AND Lift.occupant == null AND exit_clear(Lift) AND output.floor == input.target_floor AND output.occupant == null';

MERGE (tl4:Task {id: 'T_LIFT_RECOVER'})
SET tl4.name = 'Recover',
    tl4.command = 'RECOVER',
    tl4.inputParameters = '',
    tl4.outputParameters = 'state: string',
    tl4.precondition = 'exists(Lift) AND Lift.fault == true AND exists(Lift.state) AND exists(Lift.fault_remaining)',
    tl4.postcondition = 'at("LIFT_FAULT_CLEARED") AND Lift.fault == false AND Lift.fault_remaining == 0 AND Lift.until_tick == tick + before.Lift.fault_remaining AND Lift.state == before.Lift.state AND Lift.y == before.Lift.y AND Lift.floor == before.Lift.floor AND Lift.occupant == before.Lift.occupant';


// =========================
// OPERATIONALIZATION
// =========================
MATCH (gq:Goal {id:'G_LT_QUEUE'}), (tl1:Task {id:'T_LIFT_QUEUE'})
MERGE (gq)-[:OPERATIONALIZED_BY]->(tl1);

MATCH (gg:Goal {id:'G_LT_GATE'}), (tl2:Task {id:'T_LIFT_GATE'})
MERGE (gg)-[:OPERATIONALIZED_BY]->(tl2);

MATCH (gr:Goal {id:'G_LT_RIDE'}), (tl3:Task {id:'T_LIFT_SERVE'})
MERGE (gr)-[:OPERATIONALIZED_BY]->(tl3);

MATCH (gr:Goal {id:'G_LT_RECOVER'}), (tl4:Task {id:'T_LIFT_RECOVER'})
MERGE (gr)-[:OPERATIONALIZED_BY]->(tl4);

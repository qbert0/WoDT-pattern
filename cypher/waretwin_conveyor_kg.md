// =========================
// WARETWIN CONVEYOR AGENT
// =========================
// Một Agent đại diện cho cả 4 băng tải (waretwin:conveyor-CV01..CV04).
MERGE (ac:Agent {id: 'A_CONVEYOR'})
SET ac.name = 'ConveyorAgent',
    ac.thingIdPattern = 'waretwin:conveyor-*',
    ac.thingIds = ['waretwin:conveyor-CV01','waretwin:conveyor-CV02','waretwin:conveyor-CV03','waretwin:conveyor-CV04'];


// =========================
// CONVEYOR GOALS
// =========================

// Root goal
MERGE (gc_root:Goal {id: 'G_CV_PROVIDE_MATERIAL_FLOW'})
SET gc_root.name = 'ProvideMaterialFlow',
    gc_root.type = 'Maintain',
    gc_root.description = 'Cung cấp dòng hàng tự động tới các trạm đóng gói/phân loại';

MERGE (gc_run:Goal {id: 'G_CV_RUN'})
SET gc_run.name = 'TransportItemsOnBelt',
    gc_run.type = 'Maintain',
    gc_run.description = 'Vận chuyển vật phẩm trên băng tải với tốc độ đặt trước';

MERGE (gc_feed:Goal {id: 'G_CV_FEED'})
SET gc_feed.name = 'FeedStations',
    gc_feed.type = 'Achieve',
    gc_feed.description = 'Cấp hàng tới workstation được gán (PACK/SORT)';

MERGE (gc_report:Goal {id: 'G_CV_REPORT'})
SET gc_report.name = 'ReportFailure',
    gc_report.type = 'Achieve',
    gc_report.description = 'Phát hiện và báo lỗi/dừng để tránh kẹt hàng';


// =========================
// GOAL REFINEMENT
// =========================
MATCH (root:Goal {id:'G_CV_PROVIDE_MATERIAL_FLOW'}),
      (r1:Goal {id:'G_CV_RUN'}),
      (r2:Goal {id:'G_CV_FEED'}),
      (r3:Goal {id:'G_CV_REPORT'})
MERGE (root)-[a:REFINES]->(r1)
SET a.type = 'AND'
MERGE (root)-[b:REFINES]->(r2)
SET b.type = 'AND'
MERGE (root)-[c:REFINES]->(r3)
SET c.type = 'AND';


// =========================
// DELEGATION
// =========================
// Chỉ goal gốc được giao trực tiếp cho Agent. Goal con kế thừa trách nhiệm qua cây.
// Goal lá nối tới Task bằng OPERATIONALIZED_BY.
// Xóa các cạnh giao trực tiếp cũ trong model để chạy lại seed không tạo hình sao.
MATCH (root:Goal {id:'G_CV_PROVIDE_MATERIAL_FLOW'})-[:REFINES*1..]->(goal:Goal)
MATCH (goal)-[obsolete:DELEGATED_TO]->(:Agent {id:'A_CONVEYOR'})
DELETE obsolete;

MATCH (root:Goal {id:'G_CV_PROVIDE_MATERIAL_FLOW'}), (ac:Agent {id:'A_CONVEYOR'})
MERGE (root)-[:DELEGATED_TO]->(ac);


// =========================
// CONVEYOR TASKS
// =========================
MERGE (tc1:Task {id: 'T_BELT_RUN'})
SET tc1.name = 'RunBelt',
    tc1.command = 'RUN_BELT',
    tc1.inputParameters = 'speed_mps: float',
    tc1.outputParameters = 'status: string',
    tc1.precondition = 'exists(Conveyor) AND exists(layout.conveyors[Conveyor.id]) AND context.restore_requested == true AND finite(input.speed_mps) AND input.speed_mps > 0 AND input.speed_mps == layout.conveyors[Conveyor.id].speed_mps',
    tc1.postcondition = 'at("CONVEYOR_RESTORED") AND Conveyor.status == "RUNNING" AND Conveyor.speed_mps == input.speed_mps AND event_seen("CONVEYOR_STATUS_CHANGED", {"conveyor_id": before.Conveyor.id})';

MERGE (tc2:Task {id: 'T_BELT_FEED'})
SET tc2.name = 'FeedStation',
    tc2.command = 'FEED',
    tc2.inputParameters = '',
    tc2.outputParameters = 'throughput_per_min: float',
    tc2.precondition = 'Conveyor.status == "RUNNING" AND Conveyor.speed_mps > 0 AND exists(layout.locations[layout.conveyors[Conveyor.id].feeds]) AND any(r, state.robots, r.fsm == "DELIVERING" AND r.destination == layout.conveyors[Conveyor.id].feeds)',
    tc2.postcondition = 'at("DEVICES_UPDATED") AND Conveyor.items_on_belt == max(0, min(12, before.Conveyor.items_on_belt + count(r, before.state.robots, r.fsm == "DELIVERING" AND r.destination == layout.conveyors[Conveyor.id].feeds) - choose(tick % 30 == 0, 1, 0))) AND Conveyor.throughput_per_min == round((2 + Conveyor.items_on_belt * 0.3) * 10) / 10 AND output.throughput_per_min == Conveyor.throughput_per_min';

MERGE (tc3:Task {id: 'T_BELT_STOP'})
SET tc3.name = 'StopBelt',
    tc3.command = 'STOP_BELT',
    tc3.inputParameters = '',
    tc3.outputParameters = 'status: string',
    tc3.precondition = 'exists(Conveyor) AND context.stop_requested == true AND (context.stop_cause == "CONVEYOR_FAILURE" OR context.incident_report_required == true)',
    tc3.postcondition = 'at("FAILED_CONVEYOR_UPDATED") AND Conveyor.status == "ERROR" AND Conveyor.speed_mps == 0 AND Conveyor.throughput_per_min == 0 AND event_seen("CONVEYOR_STATUS_CHANGED", {"conveyor_id": before.Conveyor.id})';


// =========================
// OPERATIONALIZATION
// =========================
MATCH (gr:Goal {id:'G_CV_RUN'}), (tc1:Task {id:'T_BELT_RUN'})
MERGE (gr)-[:OPERATIONALIZED_BY]->(tc1);

MATCH (gf:Goal {id:'G_CV_FEED'}), (tc2:Task {id:'T_BELT_FEED'})
MERGE (gf)-[:OPERATIONALIZED_BY]->(tc2);

MATCH (grp:Goal {id:'G_CV_REPORT'}), (tc3:Task {id:'T_BELT_STOP'})
MERGE (grp)-[:OPERATIONALIZED_BY]->(tc3);

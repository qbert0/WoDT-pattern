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
MERGE (gc_root:Goal {id: 'G_CONV_ROOT'})
SET gc_root.name = 'ProvideMaterialFlow',
    gc_root.description = 'Cung cấp dòng hàng tự động tới các trạm đóng gói/phân loại';

MERGE (gc_run:Goal {id: 'G_CV_RUN'})
SET gc_run.name = 'TransportItemsOnBelt',
    gc_run.description = 'Vận chuyển vật phẩm trên băng tải với tốc độ đặt trước';

MERGE (gc_feed:Goal {id: 'G_CV_FEED'})
SET gc_feed.name = 'FeedStations',
    gc_feed.description = 'Cấp hàng tới workstation được gán (PACK/SORT)';

MERGE (gc_report:Goal {id: 'G_CV_REPORT'})
SET gc_report.name = 'ReportFailure',
    gc_report.description = 'Phát hiện và báo lỗi/dừng để tránh kẹt hàng';


// =========================
// GOAL REFINEMENT
// =========================
MATCH (root:Goal {id:'G_CONV_ROOT'}),
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
MATCH (root:Goal {id:'G_CONV_ROOT'}),
      (ac:Agent {id:'A_CONVEYOR'})
MERGE (root)-[:DELEGATED_TO]->(ac);


// =========================
// CONVEYOR TASKS
// =========================
MERGE (tc1:Task {id: 'T_BELT_RUN'})
SET tc1.name = 'RunBelt',
    tc1.command = 'RUN_BELT',
    tc1.inputParameters = 'speed_mps: float',
    tc1.outputParameters = 'status: string';

MERGE (tc2:Task {id: 'T_BELT_FEED'})
SET tc2.name = 'FeedStation',
    tc2.command = 'FEED',
    tc2.inputParameters = '',
    tc2.outputParameters = 'throughput_per_min: float';

MERGE (tc3:Task {id: 'T_BELT_STOP'})
SET tc3.name = 'StopBelt',
    tc3.command = 'STOP_BELT',
    tc3.inputParameters = '',
    tc3.outputParameters = 'status: string';


// =========================
// OPERATIONALIZATION
// =========================
MATCH (gr:Goal {id:'G_CV_RUN'}), (tc1:Task {id:'T_BELT_RUN'})
MERGE (gr)-[:OPERATIONALIZED_BY]->(tc1);

MATCH (gf:Goal {id:'G_CV_FEED'}), (tc2:Task {id:'T_BELT_FEED'})
MERGE (gf)-[:OPERATIONALIZED_BY]->(tc2);

MATCH (grp:Goal {id:'G_CV_REPORT'}), (tc3:Task {id:'T_BELT_STOP'})
MERGE (grp)-[:OPERATIONALIZED_BY]->(tc3);

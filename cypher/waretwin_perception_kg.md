// =========================
// WARETWIN PERCEPTION AGENT
// =========================
// Một Agent đại diện cho camera (VLM) + cảm biến (camera-*, sensor-*).
MERGE (ap:Agent {id: 'A_PERCEPTION'})
SET ap.name = 'PerceptionAgent',
    ap.thingIdPattern = 'waretwin:(camera-*|sensor-*)',
    ap.thingIds = ['waretwin:camera-CAM-A01','waretwin:camera-CAM-A02','waretwin:camera-CAM-A03',
                   'waretwin:camera-CAM-B01','waretwin:camera-CAM-B02','waretwin:camera-CAM-B03',
                   'waretwin:camera-CAM-C01','waretwin:camera-CAM-C02','waretwin:camera-CAM-C03',
                   'waretwin:camera-CAM-D01','waretwin:camera-CAM-D02','waretwin:camera-CAM-D03',
                   'waretwin:camera-CAM-DOCK-IN','waretwin:camera-CAM-DOCK-OUT',
                   'waretwin:camera-CAM-M01','waretwin:camera-CAM-M02',
                   'waretwin:sensor-S-A01','waretwin:sensor-S-B01','waretwin:sensor-S-C01',
                   'waretwin:sensor-S-CV03','waretwin:sensor-S-D01','waretwin:sensor-S-T01'];


// =========================
// PERCEPTION GOALS
// =========================

// Root goal
MERGE (gp_root:Goal {id: 'G_P_PROVIDE_SITUATIONAL_AWARENESS'})
SET gp_root.name = 'ProvideSituationalAwareness',
    gp_root.description = 'Cung cấp nhận thức tình huống cho kho: phát hiện nguy hiểm và báo telemetry';

MERGE (gp_detect:Goal {id: 'G_P_DETECT'})
SET gp_detect.name = 'DetectHazards',
    gp_detect.description = 'Phát hiện người/vật cản/sự cố từ khung CCTV qua VLM';

MERGE (gp_telemetry:Goal {id: 'G_P_TELEMETRY'})
SET gp_telemetry.name = 'ReportTelemetry',
    gp_telemetry.description = 'Báo giá trị cảm biến (presence/LIDAR/weight/temp)';


// =========================
// GOAL REFINEMENT
// =========================
MATCH (root:Goal {id:'G_P_PROVIDE_SITUATIONAL_AWARENESS'}),
      (gd:Goal {id:'G_P_DETECT'}),
      (gt:Goal {id:'G_P_TELEMETRY'})
MERGE (root)-[r1:REFINES]->(gd)
SET r1.type = 'AND'
MERGE (root)-[r2:REFINES]->(gt)
SET r2.type = 'AND';


// =========================
// DELEGATION
// =========================
// Root goal chịu trách nhiệm điều phối perception. Các leaf goal không gán trực tiếp Agent.
// REFINES chỉ nằm trong model này, không nối sang cây goal của model khác.
// Agent dùng chung theo id với tham chiếu từ system (xem waretwin_ditto_mapping.md).
MATCH (goal:Goal)-[r:DELEGATED_TO]->(ap:Agent {id:'A_PERCEPTION'})
WHERE goal.id IN ['G_P_DETECT', 'G_P_TELEMETRY']
DELETE r;

MATCH (root:Goal {id:'G_P_PROVIDE_SITUATIONAL_AWARENESS'}), (ap:Agent {id:'A_PERCEPTION'})
MERGE (root)-[:DELEGATED_TO]->(ap);


// =========================
// PERCEPTION TASKS
// =========================
MERGE (tp1:Task {id: 'T_VLM_DETECT'})
SET tp1.name = 'DetectViaVLM',
    tp1.command = 'VLM_DETECT',
    tp1.inputParameters = 'frame_id: string',
    tp1.outputParameters = 'event: string, confidence: float';

MERGE (tp2:Task {id: 'T_SENSOR_REPORT'})
SET tp2.name = 'ReportSensorValue',
    tp2.command = 'SENSOR_REPORT',
    tp2.inputParameters = '',
    tp2.outputParameters = 'value: float, unit: string';


// =========================
// OPERATIONALIZATION
// =========================
MATCH (gd:Goal {id:'G_P_DETECT'}), (tp1:Task {id:'T_VLM_DETECT'})
MERGE (gd)-[:OPERATIONALIZED_BY]->(tp1);

MATCH (gt:Goal {id:'G_P_TELEMETRY'}), (tp2:Task {id:'T_SENSOR_REPORT'})
MERGE (gt)-[:OPERATIONALIZED_BY]->(tp2);

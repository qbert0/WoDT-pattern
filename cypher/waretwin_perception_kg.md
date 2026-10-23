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
    gp_root.type = 'Maintain',
    gp_root.description = 'Cung cấp nhận thức tình huống cho kho: phát hiện nguy hiểm và báo telemetry';

MERGE (gp_detect:Goal {id: 'G_P_DETECT'})
SET gp_detect.name = 'DetectHazards',
    gp_detect.type = 'Achieve',
    gp_detect.description = 'Phát hiện người/vật cản/sự cố từ khung CCTV qua VLM';

MERGE (gp_telemetry:Goal {id: 'G_P_TELEMETRY'})
SET gp_telemetry.name = 'ReportTelemetry',
    gp_telemetry.type = 'Achieve',
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
    tp1.outputParameters = 'event: string, confidence: float',
    tp1.precondition = 'exists(Camera) AND exists(layout.cameras[Camera.id]) AND Camera.status != "OFFLINE" AND exists(input.frame_id) AND observation_input_bound(input.frame_id, Camera.id) AND (exists(context.image) OR snapshot_at(context.snapshot.robots, context.snapshot.tick))',
    tp1.postcondition = 'at("OBSERVATION_RECORDED") AND observation_for(Camera.last_observation, input.frame_id) AND Camera.last_observation.camera_id == before.Camera.id AND Camera.last_observation.zone == before.Camera.zone AND Camera.last_observation.tick == before.context.snapshot.tick AND Camera.last_observation.event IN ["human_detected", "obstacle", "spill", "none"] AND Camera.last_observation.confidence >= 0 AND Camera.last_observation.confidence <= 1 AND event_seen("VLM_OBSERVATION", {"camera_id": before.Camera.id})';

MERGE (tp2:Task {id: 'T_SENSOR_REPORT'})
SET tp2.name = 'ReportSensorValue',
    tp2.command = 'SENSOR_REPORT',
    tp2.inputParameters = '',
    tp2.outputParameters = 'value: float, unit: string',
    tp2.precondition = 'exists(Sensor) AND exists(layout.sensors[Sensor.id]) AND Sensor.status != "OFFLINE" AND Sensor.kind IN ["PRESENCE", "LIDAR", "TEMP", "WEIGHT"]',
    tp2.postcondition = 'at("DEVICES_UPDATED") AND finite(Sensor.value) AND ((Sensor.kind == "PRESENCE" AND Sensor.value IN [0, 1] AND Sensor.unit == "bool") OR (Sensor.kind == "LIDAR" AND integer(Sensor.value) AND Sensor.value >= 0 AND Sensor.unit == "objects") OR (Sensor.kind == "TEMP" AND Sensor.unit == "°C") OR (Sensor.kind == "WEIGHT" AND Sensor.value >= 0 AND Sensor.unit == "kg")) AND output.value == Sensor.value AND output.unit == Sensor.unit';


// =========================
// OPERATIONALIZATION
// =========================
MATCH (gd:Goal {id:'G_P_DETECT'}), (tp1:Task {id:'T_VLM_DETECT'})
MERGE (gd)-[:OPERATIONALIZED_BY]->(tp1);

MATCH (gt:Goal {id:'G_P_TELEMETRY'}), (tp2:Task {id:'T_SENSOR_REPORT'})
MERGE (gt)-[:OPERATIONALIZED_BY]->(tp2);

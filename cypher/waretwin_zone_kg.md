// =========================
// WARETWIN ZONE AGENT
// =========================
// Một Agent đại diện cho cả 5 zone (waretwin:zone-A..D + zone-M).
MERGE (az:Agent {id: 'A_ZONE'})
SET az.name = 'ZoneAgent',
    az.thingIdPattern = 'waretwin:zone-*',
    az.thingIds = ['waretwin:zone-A','waretwin:zone-B','waretwin:zone-C','waretwin:zone-D','waretwin:zone-M'];


// =========================
// ZONE GOALS
// =========================

// Root goal
MERGE (gz_root:Goal {id: 'G_Z_MAINTAIN_SAFE_TRAFFIC'})
SET gz_root.name = 'MaintainSafeTraffic',
    gz_root.type = 'Maintain',
    gz_root.description = 'Duy trì giao thông an toàn, phát hiện tắc nghẽn và cách ly khu vực nguy hiểm';

MERGE (gz_monitor:Goal {id: 'G_Z_MONITOR'})
SET gz_monitor.name = 'MonitorCongestion',
    gz_monitor.type = 'Maintain',
    gz_monitor.description = 'Theo dõi mật độ robot và mức tắc nghẽn từng zone';

MERGE (gz_block:Goal {id: 'G_Z_BLOCK'})
SET gz_block.name = 'BlockOnHazard',
    gz_block.type = 'Achieve',
    gz_block.description = 'Chặn zone khi có người/vật cản để robot định tuyến vòng';


// =========================
// GOAL REFINEMENT
// =========================
MATCH (root:Goal {id:'G_Z_MAINTAIN_SAFE_TRAFFIC'}),
      (gm:Goal {id:'G_Z_MONITOR'}),
      (gb:Goal {id:'G_Z_BLOCK'})
MERGE (root)-[r1:REFINES]->(gm)
SET r1.type = 'AND'
MERGE (root)-[r2:REFINES]->(gb)
SET r2.type = 'AND';


// =========================
// DELEGATION
// =========================
// Root goal chịu trách nhiệm điều phối zone. Các leaf goal không gán trực tiếp Agent.
// REFINES chỉ nằm trong model này, không nối sang cây goal của model khác.
// Agent dùng chung theo id với tham chiếu từ system (xem waretwin_ditto_mapping.md).
MATCH (goal:Goal)-[r:DELEGATED_TO]->(az:Agent {id:'A_ZONE'})
WHERE goal.id IN ['G_Z_MONITOR', 'G_Z_BLOCK']
DELETE r;

MATCH (root:Goal {id:'G_Z_MAINTAIN_SAFE_TRAFFIC'}), (az:Agent {id:'A_ZONE'})
MERGE (root)-[:DELEGATED_TO]->(az);


// =========================
// ZONE TASKS
// =========================
MERGE (tz1:Task {id: 'T_ZONE_MONITOR'})
SET tz1.name = 'MonitorTraffic',
    tz1.command = 'MONITOR',
    tz1.inputParameters = '',
    tz1.outputParameters = 'robot_count: int, congestion: float',
    tz1.precondition = 'exists(Zone) AND exists(layout.zones[Zone.id]) AND snapshot_at(state.robots, tick) AND exists(layout.zones[Zone.id].floor)',
    tz1.postcondition = 'at("ZONES_UPDATED") AND Zone.robot_count == count(r, before.state.robots, r.zone == Zone.id) AND Zone.congestion == choose(Zone.id IN blocked_zones, min(1, Zone.robot_count / (SIM.ZONE_CAPACITY + choose(layout.zones[Zone.id].floor == 2, 2, 0))), max(min(1, Zone.robot_count / (SIM.ZONE_CAPACITY + choose(layout.zones[Zone.id].floor == 2, 2, 0))), congestion_level(Zone.id))) AND Zone.status == choose(Zone.id IN blocked_zones, "BLOCKED", choose(Zone.congestion >= 0.6, "CONGESTED", "NORMAL"))';

MERGE (tz2:Task {id: 'T_ZONE_BLOCK'})
SET tz2.name = 'BlockZone',
    tz2.command = 'BLOCK',
    tz2.inputParameters = 'duration_ticks: int',
    tz2.outputParameters = 'status: string',
    tz2.precondition = 'exists(Zone) AND exists(layout.zones[Zone.id].bounds) AND integer(input.duration_ticks) AND input.duration_ticks > 0 AND exists(context.reason) AND context.reason != ""',
    tz2.postcondition = 'at("BLOCKED_ZONE_UPDATED") AND tick < before.tick + input.duration_ticks AND Zone.id IN blocked_zones AND Zone.status == "BLOCKED" AND exists(Zone.blocked_reason) AND exists(Zone.blocked_since_tick) AND block_record(Zone.id, before.tick).expires_tick == before.tick + input.duration_ticks AND affected_routes_notified(Zone.id, before)';


// =========================
// OPERATIONALIZATION
// =========================
MATCH (gm:Goal {id:'G_Z_MONITOR'}), (tz1:Task {id:'T_ZONE_MONITOR'})
MERGE (gm)-[:OPERATIONALIZED_BY]->(tz1);

MATCH (gb:Goal {id:'G_Z_BLOCK'}), (tz2:Task {id:'T_ZONE_BLOCK'})
MERGE (gb)-[:OPERATIONALIZED_BY]->(tz2);

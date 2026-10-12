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
MERGE (gz_root:Goal {id: 'G_ZONE_ROOT'})
SET gz_root.name = 'MaintainSafeTraffic',
    gz_root.description = 'Duy trì giao thông an toàn, phát hiện tắc nghẽn và cách ly khu vực nguy hiểm';

MERGE (gz_monitor:Goal {id: 'G_Z_MONITOR'})
SET gz_monitor.name = 'MonitorCongestion',
    gz_monitor.description = 'Theo dõi mật độ robot và mức tắc nghẽn từng zone';

MERGE (gz_block:Goal {id: 'G_Z_BLOCK'})
SET gz_block.name = 'BlockOnHazard',
    gz_block.description = 'Chặn zone khi có người/vật cản để robot định tuyến vòng';


// =========================
// GOAL REFINEMENT
// =========================
MATCH (root:Goal {id:'G_ZONE_ROOT'}),
      (gm:Goal {id:'G_Z_MONITOR'}),
      (gb:Goal {id:'G_Z_BLOCK'})
MERGE (root)-[r1:REFINES]->(gm)
SET r1.type = 'AND'
MERGE (root)-[r2:REFINES]->(gb)
SET r2.type = 'AND';


// =========================
// DELEGATION
// =========================
MATCH (root:Goal {id:'G_ZONE_ROOT'}),
      (az:Agent {id:'A_ZONE'})
MERGE (root)-[:DELEGATED_TO]->(az);


// =========================
// ZONE TASKS
// =========================
MERGE (tz1:Task {id: 'T_ZONE_MONITOR'})
SET tz1.name = 'MonitorTraffic',
    tz1.command = 'MONITOR',
    tz1.inputParameters = '',
    tz1.outputParameters = 'robot_count: int, congestion: float';

MERGE (tz2:Task {id: 'T_ZONE_BLOCK'})
SET tz2.name = 'BlockZone',
    tz2.command = 'BLOCK',
    tz2.inputParameters = 'duration_ticks: int',
    tz2.outputParameters = 'status: string';


// =========================
// OPERATIONALIZATION
// =========================
MATCH (gm:Goal {id:'G_Z_MONITOR'}), (tz1:Task {id:'T_ZONE_MONITOR'})
MERGE (gm)-[:OPERATIONALIZED_BY]->(tz1);

MATCH (gb:Goal {id:'G_Z_BLOCK'}), (tz2:Task {id:'T_ZONE_BLOCK'})
MERGE (gb)-[:OPERATIONALIZED_BY]->(tz2);

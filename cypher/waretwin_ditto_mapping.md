# WareTwin DT → Goal Graph mapping

Ánh xạ giữa các Digital Twin trên Eclipse Ditto (namespace `waretwin`) và goal knowledge graph
trong Neo4j. Mỗi Thing được gắn `attributes.goalRootId` trỏ tới root Goal do Agent tương ứng
sở hữu (`DELEGATED_TO`).

## Agents & Thing

| Agent (Neo4j) | Ditto thingId(s) | root Goal | Số Thing |
|---|---|---|---|
| `A_WARETWIN` (WarehouseCoordinatorAgent) | `waretwin:warehouse` (+ `task-*` qua `taskThingPattern`) | `G_WT_ROOT` | 1 |
| `A_ROBOT` (RobotAgent) | `waretwin:robot-R01` … `R20` | `G_ROBOT_ROOT` | 20 |
| `A_LIFT` (LiftAgent) | `waretwin:lift-LIFT-1`, `LIFT-2` | `G_LIFT_ROOT` | 2 |
| `A_CONVEYOR` (ConveyorAgent) | `waretwin:conveyor-CV01` … `CV04` | `G_CONV_ROOT` | 4 |
| `A_ZONE` (ZoneAgent) | `waretwin:zone-A` … `zone-M` | `G_ZONE_ROOT` | 5 |
| `A_PERCEPTION` (PerceptionAgent) | `waretwin:camera-*`, `waretwin:sensor-*` | `G_PERCEPTION_ROOT` | 22 |

Riêng Thing đơn hàng động `waretwin:task-A*` trỏ tới `G_WT_ALLOC` (goal `AllocateOrders` của
`A_WARETWIN`), không có Agent riêng.

## Goal tree tóm tắt

| Root | Nhánh chính | Task tiêu biểu |
|---|---|---|
| `G_WT_ROOT` | TransportGoods / EnsureCrossFloorFlow / EnsureOperationalSafety / MaintainFleetEnergy / MaintainInfrastructureAvailability / AllocateOrders | `T_ORDER_PICK/TRANSPORT/REPLENISH/RETURN` |
| `G_ROBOT_ROOT` | TransportItem (Navigate/Pick/Deliver) · MaintainBattery (Reach/Recharge) · EnsureCollisionFreeOperation | `T_R_NAVIGATE/PICK/DROP/CHARGE/RECHARGE/AVOID` |
| `G_LIFT_ROOT` | ServeTransportRequest (Queue/Gate/Move) · RecoverFromFault | `T_LIFT_QUEUE/GATE/SERVE/RECOVER` |
| `G_CONV_ROOT` | TransportItemsOnBelt · FeedStations · ReportFailure | `T_BELT_RUN/FEED/STOP` |
| `G_ZONE_ROOT` | MonitorCongestion · BlockOnHazard | `T_ZONE_MONITOR/BLOCK` |
| `G_PERCEPTION_ROOT` | DetectHazards · ReportTelemetry | `T_VLM_DETECT/SENSOR_REPORT` |

## Quan hệ

| Quan hệ | Từ → Đến | Ghi chú |
|---|---|---|
| `REFINES {type: AND\|OR}` | Goal → Goal | Phân rã mục tiêu |
| `DELEGATED_TO` | root Goal → Agent | Gán trách nhiệm |
| `OPERATIONALIZED_BY` | leaf Goal → Task | Cách thực thi |
| `DEPENDS_ON {type: ACHIEVED}` | leaf Goal → leaf/root Goal | System ↔ component, DT ↔ DT |
| `DEPENDS_ON {type: EXECUTION\|PARAMETER}` | Task → Task | Thứ tự / truyền tham số |

## Nguồn dữ liệu

- Graph nodes: các file `waretwin_*_kg.md` trong thư mục này (seed bằng `seed_neo4j.py`).
- Attribute trên Ditto: `backend/app/mqtt.py::SECTION_GOAL_ROOT` + `WAREHOUSE_GOAL_ROOT`
  (repo WareTwin) — bridge ghi `goalRootId`/`goalAgentId` lúc tạo Thing.

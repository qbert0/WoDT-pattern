# Goal model đơn giản của Robot DT

Source: `goal_model/waretwin_robot.json`. Cấu trúc theo mẫu coffee:

```json
{
  "systemId": "WareTwinRobot",
  "participants": ["RobotAgent", "WarehouseCoordinatorAgent", "LiftAgent", "PerceptionAgent"],
  "goal": {
    "id": "G_R_NAVIGATE",
    "description": "Đến đúng vị trí và tầng đích",
    "type": "Achieve",
    "clause": "RobotAgent.floor == Task.target_floor AND RobotAgent.distance_to_target <= Task.position_tolerance_m",
    "depends_on": {
      "actor": "LiftAgent",
      "goal": "G_LT_PROVIDE_VERTICAL_TRANSPORT",
      "when": "Task.source_floor != Task.target_floor",
      "clause": "LiftAgent.transport_complete == true AND LiftAgent.floor == Task.target_floor",
      "binding": {
        "robot_id": "RobotAgent.id",
        "source_floor": "Task.source_floor",
        "target_floor": "Task.target_floor"
      }
    }
  },
  "parameter_dependency": []
}
```

Ví dụ trên trích nhánh Navigate. File đầy đủ có root `G_WT_TRANSPORT`, 10 goal
và 6 dependency (4 goal dependency, 2 parameter dependency).

## Các trường

| Trường | Ý nghĩa |
|---|---|
| `systemId` | Tên model |
| `participants` | Các Agent tham gia |
| `goal` | Cây mục tiêu |
| `id`, `description` | ID và mô tả mục tiêu |
| `type` | `Achieve`: đạt một kết quả; `Maintain`: duy trì điều kiện; `Avoid`: ngăn trạng thái nguy hiểm |
| `clause` | Điều kiện đạt mục tiêu hoặc đáp ứng dependency |
| `refinement`, `children` | Phân rã AND/OR và các goal con |
| `when` | Điều kiện áp dụng, chỉ khai báo khi cần |
| `depends_on` | Phụ thuộc goal của Agent nào, kèm điều kiện và binding |
| `binding` | Giá trị/tham chiếu truyền sang bên cung cấp |
| `parameter_dependency` | Danh sách ánh xạ tham số: `from`, `to`, `rule`, tùy chọn `when` |

Tên goal trong `depends_on.goal` dùng ID Neo4j để tránh nhầm các tên giống nhau.
Biểu thức là mô tả khai báo với `AND`, `OR`, `true`, `satisfied`…, không phải
Cypher hay chương trình tự chạy. Validator kiểm tra cấu trúc và tham chiếu graph,
không đánh giá biểu thức theo telemetry.

## Cây Robot

```text
TransportGoods
├── ExecuteTransportTasks
│   ├── TransportItem
│   │   ├── NavigateToTarget
│   │   ├── PickLoad
│   │   └── DeliverLoad
│   └── EnsureCollisionFreeOperation
└── MaintainBattery
    ├── ReachCharger       [khi cần sạc]
    └── RechargeBattery    [khi cần sạc, phụ thuộc ReachCharger]
```

- Navigate: đúng tầng, khoảng cách tới đích trong tolerance của nhiệm vụ.
- Pick/Drop: đúng robot, lấy/giao đủ hàng của nhiệm vụ.
- Safety (`Avoid`): không va chạm, perception bật, tuân thủ giới hạn tốc độ và khoảng dừng.
  `clause` luôn là điều kiện thỏa mãn, kể cả với `Avoid`: biểu thức đúng nghĩa là
  đang đáp ứng yêu cầu an toàn, không phải đã xảy ra nguy hiểm. Không đảo phủ định clause.
- Energy: pin tối thiểu 10%; khi cần sạc thì tới charger và sạc đến 95%.
- Nhánh không thỏa `when` không bắt buộc trong AND. Pin bình thường không đòi robot
  phải đi sạc. Goal Energy vẫn kiểm tra trực tiếp ngưỡng 10% khi đang phục hồi.
- Kết quả Achieve được giữ cho lần thực hiện hiện tại: giao hàng xong không làm
  mất kết quả đã lấy hàng. Maintain và Avoid được kiểm tra trong suốt quá trình vận chuyển.
  Đây là ngữ nghĩa khai báo; runtime evaluator chưa được tích hợp.

## Quy ước dữ liệu

Các tên Agent trong clause chỉ **instance đang tham gia nhiệm vụ**, không phải toàn
bộ robot/thang/camera. Kết quả lấy/giao hàng, thang máy và sạc phải thuộc cùng nhiệm
vụ/lần sử dụng. Chi tiết quản lý instance nằm ở runtime, không đưa vào schema này.

| Tên rút gọn | Nguồn/ý nghĩa |
|---|---|
| `RobotAgent.id`, `task_id`, `zone` | Robot và nhiệm vụ/khu vực đang xét |
| `floor`, `battery`, `velocity`, `load`, `capacity`, `ahead_m` | Telemetry robot; load/capacity tương ứng `load.current`/`load.capacity` |
| `max_speed`, `stop_distance_m` | Giới hạn từ cấu hình robot/điều khiển |
| `perception_active` | Trạng thái perception khác `OFF` |
| `distance_to_target` | Khoảng cách XZ từ vị trí hiện tại tới điểm đích |
| `picked_units`, `delivered_units` | Lượng hàng đã xác nhận lấy/giao trong nhiệm vụ |
| `collision_free` | Bằng chứng không va chạm trong khoảng đánh giá |
| `charger_id`, `at_charger` | Trạm được chọn và xác nhận đã cập đúng trạm, trước khi nạp điện |
| `needs_charge` | Cờ yêu cầu sạc do controller giữ từ khi cần sạc (ngưỡng cảnh báo 20%) tới khi hoàn tất/hủy |
| `Task.*` | Nhiệm vụ hiện tại: robot được giao, lượng hàng, trạng thái, tầng đi/đến và tolerance |
| `LiftAgent.transport_complete` | Đã hoàn thành vận chuyển đúng robot/yêu cầu, gồm bước ra khỏi thang |
| `PerceptionAgent.observation_valid` | Camera online, quan sát đủ mới và đủ tin cậy theo policy runtime |
| `PerceptionAgent.zone` | Khu vực của observation; kết quả không có hazard vẫn hợp lệ |

Các giá trị suy ra như `distance_to_target`, `at_charger`, `collision_free`,
`transport_complete`, `observation_valid` không phải field mới tự xuất hiện trên
Ditto. Adapter/evaluator cần cung cấp chúng; thiếu dữ liệu thì chưa thể kết luận đạt.

## Dependency

1. Transport → Warehouse Allocate: nhiệm vụ được giao đúng robot.
2. Navigate → Lift transport: chỉ khi tầng đi khác tầng đến.
3. Safety → Perception Detect: observation hợp lệ, đúng zone.
4. Recharge → ReachCharger: đã tới đúng trạm trước khi sạc.
5. Pick.load_units → Drop.load_units: giao đúng lượng đã lấy.
6. Navigate.target_floor → Lift Serve.target_floor: tầng đích lấy ngay từ yêu cầu
   Navigate, không chờ Navigate hoàn thành. Chiều cạnh Neo4j là bên nhận `DEPENDS_ON`
   bên cung cấp, ngược chiều truyền dữ liệu.

## Neo4j và cập nhật

- Goal lưu `type`, `description`, `clause`, `when`, `refinement`, `systemId`.
- Root thêm `participants`; `children` được biểu diễn bằng cạnh `REFINES`.
- `depends_on` được biểu diễn bằng cạnh `DEPENDS_ON`, với `actor`, `clause`, `when`,
  `binding`. `binding` là JSON string vì Neo4j không hỗ trợ nested map làm property.
- Parameter edge lưu `from`, `to`, `rule`, `when` và tên tham số nguồn/đích.
- Loader xóa các property cũ như `contextSchemaJson`, `parameterSchemaJson`,
  `evaluationPolicyJson`, `correlation`, `activationCondition`… khỏi Robot contract.
- Dependency sạc chuyển từ Task → Task sang Goal → Goal để biểu diễn trực tiếp
  trong `depends_on`; các Task và `OPERATIONALIZED_BY` vẫn nối với goal tương ứng.

Chạy từ root `WoDT-pattern`:

```bash
python3 cypher/seed_neo4j.py --validate-only
python3 -m unittest discover -s cypher/tests -v
smart_kettle_simulator/.venv/bin/python cypher/seed_neo4j.py --waretwin-only
```

Loader nạp topology Cypher rồi áp dụng JSON. Chạy riêng file Cypher không nạp đủ
conditions từ JSON. Bước áp dụng JSON chạy trong một transaction; topology được
nạp trước đó. Model hiện lưu điều kiện, chưa tích hợp runtime evaluator.

```cypher
MATCH (g:Goal {systemId: 'WareTwinRobot'})
RETURN g.id, g.type, g.description, g.clause, g.when, g.refinement;

MATCH (s)-[r:DEPENDS_ON {systemId: 'WareTwinRobot'}]->(t)
RETURN s.id, t.id, properties(r);
```

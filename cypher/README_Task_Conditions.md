# Điều kiện Pre/Post cho 22 task WareTwin

Mỗi `Task` có hai thuộc tính chuỗi:

- `precondition`: biểu thức cần thỏa trước khi bắt đầu tác vụ.
- `postcondition`: điều kiện xác nhận kết quả tại thời điểm hoàn tất tác vụ.

Định nghĩa nằm trực tiếp trong phần `MERGE/SET` của sáu file seed:

| File | Task | Số lượng |
| --- | --- | ---: |
| `waretwin_robot_kg.md` | NAVIGATE, PICK, DROP, CHARGE, RECHARGE, AVOID | 6 |
| `waretwin_lift_kg.md` | QUEUE, GATE, SERVE, RECOVER | 4 |
| `waretwin_conveyor_kg.md` | RUN, FEED, STOP | 3 |
| `waretwin_zone_kg.md` | MONITOR, BLOCK | 2 |
| `waretwin_perception_kg.md` | VLM_DETECT, SENSOR_REPORT | 2 |
| `waretwin_system_kg.md` | 4 ORDER task và FLEET_COLLECT_ENERGY | 5 |

## Cú pháp biểu thức logic

44 giá trị Pre/Post là **biểu thức đặc tả**, không phải câu ngôn ngữ tự nhiên,
Cypher thực thi, Python hay mã có thể truyền vào `eval`. Chưa có bộ đánh giá
runtime: lưu chúng vào Neo4j không tự chặn lệnh hoặc xác nhận task hoàn tất.

- Toán tử: `AND`, `OR`, `NOT`, `IN`, `NOT IN`, `==`, `!=`, `<`, `<=`, `>`,
  `>=`, `+`, `-`, `*`, `/`, `%`. Ưu tiên số học, so sánh, `NOT`, `AND`, rồi
  `OR`. Dùng ngoặc cho mọi nhánh lựa chọn kết hợp với điều kiện chung.
- Literal: số, `true`, `false`, `null`, chuỗi/enum trong nháy kép, danh sách
  `[a, b]`, map `{"key": value}`. Truy cập trường bằng `.`, phần tử bằng `[]`.
  Không dùng nháy đơn, dấu chấm phẩy hoặc escape trong nội dung biểu thức vì
  bộ đọc seed hiện tách câu lệnh theo dấu chấm phẩy.
- `all(x, collection, condition)`, `any(x, collection, condition)` và
  `count(x, collection, condition)` ràng buộc biến `x` trong đối số cuối.
  Collection là map thì duyệt **giá trị**; riêng `key IN map` kiểm tra khóa.
  `all` trên tập rỗng là true, `any` là false, `count` là 0.
- `choose(condition, yes, no)` chỉ chọn nhánh tương ứng. Dữ liệu thiếu,
  snapshot không đồng bộ hoặc không có dấu vết của lần chạy không được tự
  thay bằng 0/false/null để kết luận đạt. Chỉ đạt khi đủ bằng chứng cho nhánh
  được sử dụng. `null` là giá trị đã biết, khác với không đọc được trường.

Ví dụ phần kiểm tra trạng thái Robot:

```text
Robot.fsm NOT IN ["OFFLINE", "ERROR"] AND Robot.battery > 0
```

Ví dụ Post của RECHARGE:

```text
at("RECHARGE_COMPLETED") AND Robot.battery >= 95 AND Robot.battery <= 100 AND Robot.fsm == "IDLE" AND runtime.charger_id == null AND charger_busy[before.runtime.charger_id] == null AND output.battery == Robot.battery
```

### Nguồn dữ liệu và định danh

| Ký hiệu | Định nghĩa |
| --- | --- |
| `input.*`, `output.*` | Tham số yêu cầu và kết quả của đúng lần chạy task. `input.source`, `destination`, `priority`, `load_units` của ORDER lấy từ yêu cầu `create_task`; `inputParameters` đang rỗng trong seed không có nghĩa các giá trị này không tồn tại trong yêu cầu. Không sửa metadata tham số/API trong thay đổi này. |
| `Robot`, `Lift`, `Conveyor`, `Zone`, `Camera`, `Sensor` | Bản ghi instance trong `TwinState` theo ID được chọn lúc bắt đầu. ID này cố định suốt lần chạy, không chọn lại instance sau khi hoàn tất. |
| `Task` | Nhiệm vụ kho trong `state.tasks`, không phải node `:Task` trong KG. Trước PICK/DROP lấy từ `Robot.current_task_id`; sau đó đọc theo `before.Task.id`, kể cả khi Robot đã xóa ID. |
| `state`, `tick` | `engine.state` và `state.sim.tick` tại điểm kiểm tra. |
| `runtime` | `engine.rt[Robot.id]`. |
| `before.*` | Bản chụp bất biến ngay trước thao tác, gồm instance, runtime, state, tick và context. Lưu ID robot/task/lift/charger, giá trị trước cập nhật và mốc sự kiện để không dùng nhầm dữ liệu mới. |
| `before.station_slowdown` | Hệ số `_station_slowdown(Task.destination)` **đã dùng khi khởi tạo** dwell của lần DELIVERING này (1, 2 hoặc 4), không tính lại sau khi băng tải đổi trạng thái. |
| `layout.*` | Góc nhìn tra cứu layout: `floors` là tập ID tầng; `locations` là `engine.loc`; conveyors/zones/cameras/sensors tra theo ID; charging_stations duyệt bản ghi. `zones[id].bounds` và `.floor` lấy từ `_zone_bounds`/`_zone_floor`; các location/trạm/vùng thiếu floor dùng tầng mặc định 1 như engine. Đây là ký hiệu chiếu dữ liệu, không thêm field vào layout thật. |
| `charger_busy`, `blocked_zones`, `SIM` | Cấu trúc runtime và hằng số tương ứng trong engine; `SIM.X` biểu diễn `SIM["X"]`. |
| `context` | Dữ liệu của lần gọi, chưa phải field telemetry: `restore_requested`, `stop_requested`, `stop_cause`, `incident_report_required`, `reason`; với VLM gồm `image` và `snapshot` đầu vào (snapshot có `.robots`, `.tick` chiếu từ state). |

Pre được kiểm tra tại đầu thao tác tương ứng. PICK/DROP bắt đầu khi vào pha
PICKING/DELIVERING, GATE bắt đầu khi vào pha mở/đóng cửa. FEED/SENSOR_REPORT
chụp `before` ngay trước `_update_devices`; MONITOR ngay trước `_update_zones`.
VLM giữ snapshot trước tác vụ bất đồng bộ, không thay tick quan sát bằng tick
phát sự kiện. Thu thập năng lượng giữ toàn bộ snapshot, kể cả OFFLINE/ERROR.

`before` phải giữ thêm dấu vết các chuyển pha, đường đi được chấp nhận, tác vụ
bất đồng bộ và mốc sự kiện cho chính lần chạy. Không mặc định các dữ liệu này
đã có trên Ditto, hoặc chỉ cần một snapshot cuối là đủ.

### Hàm và predicate cơ bản

Các tên sau là ký hiệu đặc tả; bảng định nghĩa ý nghĩa để người đọc hoặc bộ
đánh giá tương lai triển khai, không khai báo rằng engine đã có các hàm này.

| Ký hiệu | Định nghĩa |
| --- | --- |
| `exists(value)` | Giá trị/bản ghi tồn tại và khác null; tra cứu không tìm thấy trả false. Đối với dữ liệu không truy cập được, chưa đủ bằng chứng để kết luận. |
| `finite(value)` | Là số hữu hạn, không NaN hoặc ±infinity, không boolean. |
| `integer(value)` | Là số nguyên, không boolean. |
| `all(x, collection, condition)` | Mọi phần tử thỏa điều kiện, biến x chỉ có hiệu lực trong condition. |
| `any(x, collection, condition)` | Có ít nhất một phần tử thỏa điều kiện. |
| `count(x, collection, condition)` | Số phần tử thỏa điều kiện; giữ cả số lần xuất hiện trùng. |
| `size(collection)` | Số phần tử, không loại trùng. |
| `choose(condition, yes, no)` | Giá trị yes khi condition đúng, no khi sai; condition chưa biết thì chưa kết luận. |
| `min(a, b)` | Giá trị nhỏ hơn của hai số. |
| `max(a, b)` | Giá trị lớn hơn của hai số. |
| `round(value)` | Quy tắc `jsround` của engine (floor(value + 0.5)), không phải banker rounding của Python. |
| `str(value)` | Chuyển số tầng thành khóa chuỗi, ví dụ 1 thành "1". |
| `index_of(list, value)` | Chỉ số lần xuất hiện đầu tiên, đếm từ 0; không tìm thấy thì chưa thỏa. QUEUE kiểm tra thêm số lần xuất hiện đúng bằng 1. |
| `snapshot_at(robots, tick)` | Collection robots được chụp đầy đủ, nhất quán ở tick xác định; không ghép nhiều bản telemetry khác tick. |
| `phase_ticks(id, phase)` | Số bước thực thi của pha tương ứng trong lần chạy: PICK/DELIVERING đếm lần giảm dwell, GATE đếm thời gian pha có tiến triển và không tính thời gian lift fault đóng băng. Không dùng tổng thời gian từ khi tạo nhiệm vụ kho. |
| `event_seen(type, fields)` | Có sự kiện mới của lần chạy sau mốc sự kiện đã lưu ở đầu thao tác và đến điểm Post, type và mọi trường trong map khớp. Dùng mốc thứ tự/ID sự kiện, không chỉ so tick vì nhiều sự kiện cùng tick. Với thao tác lặp hoặc đồng thời phải có dấu vết liên kết lần gọi; thiếu liên kết thì chưa xác nhận. |
| `at(point)` | Đang quan sát đúng điểm hoàn tất/lấy mẫu của lần chạy trong bảng bên dưới, trước khi trạng thái bị thao tác tiếp theo thay đổi. Không phải phép kiểm tra tick đơn thuần. |

### Điểm kiểm tra Post

| Giá trị point của at | Điểm quan sát |
| --- | --- |
| `NAVIGATION_COMPLETED` | Hoàn tất chặng đích cuối đã yêu cầu, không phải chặng vào sảnh thang hoặc lùi nhường đường. |
| `PICK_COMPLETED` | Sau đủ bước PICKING, đã lấy hàng và chuyển TRANSPORTING trong cùng `_step_robot`. |
| `DROP_COMPLETED` | Ngay sau `_complete_task`, trước tick sau chuyển COMPLETED thành IDLE. |
| `CHARGER_DOCKED` | Ngay khi GOING_TO_CHARGE chuyển CHARGING và robot cập bến. |
| `RECHARGE_COMPLETED` | Ngay khi sạc đạt ngưỡng, giải phóng trạm và chuyển IDLE. |
| `AVOIDANCE_CHECKED` | Sau bước xử lý vật cản/định tuyến/di chuyển của lần AVOID, kiểm tra dừng hoặc tuyến mới và an toàn bước di chuyển. |
| `QUEUE_INSERTED` | Sau khi `_handle_lift` thêm robot vào queue và đặt QUEUED, trước khi robot lên cabin. |
| `GATE_COMPLETED` | Tại lần `_step_lifts` kết thúc pha cửa: OPEN vào BOARDING/ALIGHTING; CLOSE đã đóng cả hai cửa trước khi khởi động chuyển động/cooldown (trong cùng hàm). |
| `LIFT_EXIT_COMPLETED` | Sau nhánh ALIGHTING của `_handle_lift`: robot ra khỏi vùng cửa, có ROBOT_EXITED và đã xóa các tham chiếu lift. |
| `LIFT_FAULT_CLEARED` | Ngay sau `clear_injection("LIFT_FAULT", id)`, trước bước mô phỏng tiếp theo. |
| `CONVEYOR_RESTORED` | Ngay sau `clear_injection("CONVEYOR_FAILURE", id)` của lần khôi phục. |
| `DEVICES_UPDATED` | Ngay sau lần `_update_devices` dùng snapshot trước cập nhật của FEED/SENSOR_REPORT. |
| `FAILED_CONVEYOR_UPDATED` | Sau áp dụng CONVEYOR_FAILURE cho băng tải và lần `_update_devices` đầu tiên sau đó. |
| `ZONES_UPDATED` | Ngay sau `_update_zones` tương ứng snapshot đầu vào MONITOR. |
| `BLOCKED_ZONE_UPDATED` | Sau `block_zone` và lần cập nhật vùng kế tiếp của yêu cầu, trước khi hết hạn phong tỏa. |
| `OBSERVATION_RECORDED` | Kết quả của đúng frame/lần gọi đã được ghi vào Camera.last_observation và phát VLM_OBSERVATION, trước kết quả lần gọi khác ghi đè. |
| `ORDER_CREATED` | Ngay sau `create_task`, trước `_assign_tasks` hoặc bước mô phỏng khác; task mới vẫn WAITING. |
| `ENERGY_SNAPSHOT_COLLECTED` | Khi xây xong kết quả từ snapshot đầu vào, không lấy lại pin từ trạng thái mới. |

### Predicate nghiệp vụ

Các predicate về chuyển động dùng layout, grid, state và runtime trong
`../WareTwin/backend/app/sim/engine.py`; nhận bản ghi/ID đã được cố định cho
lần chạy. Predicate liên quan lịch sử chỉ đạt khi có bằng chứng chuyển tiếp,
không suy diễn từ tên FSM cuối cùng.

| Ký hiệu | Định nghĩa và nguồn đối chiếu |
| --- | --- |
| `walkable_target(floor, x, z)` | Grid của tầng có ô đích đi được do `nearest_walkable` hoặc `_free_service_cell` chọn cho tọa độ yêu cầu, theo `_plan_to`. |
| `lift_route_available(robot, floor)` | Có lift trong layout phục vụ tầng hiện tại và tầng đích, state lift.fault == false; dựa trên layout lift và `_pick_lift`. Không yêu cầu lift đang IDLE. |
| `route_available(robot, floor, point)` | Có đường trên grid từ robot tới point; nếu khác tầng, có đường tới sảnh, lift không fault phục vụ hai tầng và đường từ cửa ra tới đích. Dùng cùng grid/ô hợp lệ và quy tắc lập tuyến của `_plan_to`; không coi target == null do tìm đường thất bại là đã tới. |
| `destination_reached(robot, floor, x, z)` | Lịch sử `_plan_to`/`_move_along_path` chứng minh chặng tới đích yêu cầu đã hoàn tất ở ô đích/ô phục vụ engine chấp nhận trên tầng đó. Loại trừ tìm đường thất bại, TO_LIFT và backing_off; không chỉ kiểm tra target == null. |
| `service_position(robot, location_id)` | Robot đã hoàn tất chặng tới điểm phục vụ của location: ô `_free_service_cell`/`nearest_walkable` hoặc vị trí chờ được `_move_along_path` chấp nhận trong STATION_ARRIVE_CELLS khi bị chặn. Phải có trace chấp nhận cho chính nguồn/đích đó. |
| `transfer_completed(robot_id)` | Trong chuỗi xử lý hiện tại, nhánh TASK_TRANSFER đã chuyển giao nhiệm vụ (TASK_TRANSFERRED, task mới nối parent_task_id tới nhiệm vụ cũ), xóa current_task_id và tải trước `_go_charge`. Sự kiện của lần chuyển giao cũ không đủ. |
| `charger_docked(robot, charger_id)` | Trạm được chọn thuộc đúng tầng, robot ở vị trí cập bến `_step_robot` đặt: x = station.position[0], z = station.position[2] - 1.9 và heading = pi/2. |
| `path_obstructed(robot)` | Dấu vết perception/grid chỉ ra vật cản trên đường còn lại của robot, theo `_update_perception` và `_move_along_path`. |
| `next_cell_occupied(robot)` | Ô tiếp theo hoặc ô trực giao cần giữ khi đi chéo bị robot khác chiếm theo occupancy của tầng hiện tại. |
| `path_blocked(robot)` | Đường vẫn bị chặn bởi vật cản/occupancy/perception hoặc kiểm tra khoảng cách/OBB trong bước đang xét; không tự suy ra từ FSM. |
| `valid_detour(robot, initial_runtime)` | Tuyến tránh hiện tại tồn tại trên grid, liên tục, đi được, tránh ô chặn và tiếp tục tới mục tiêu đang phục vụ từ initial_runtime, không chỉ đổi FSM sau REPLANNING. |
| `phase_resumed(robot, phase)` | Pha lưu trước tránh vật cản đã được tiếp tục: TO_DEST → TRANSPORTING, TO_CHARGER → GOING_TO_CHARGE, TO_PARK → IDLE với runtime.phase == TO_PARK, còn lại → NAVIGATING; xác minh runtime.phase vẫn là phase đó. |
| `safe_motion(robot, initial_snapshot)` | Mỗi bước chuyển động thực tế trong lần AVOID tuân thủ kiểm tra `_move_along_path`: không bước gần robot cùng tầng hơn khi khoảng cách mới < MIN_SEP hoặc OBB giao nhau trong miền kiểm tra 1.5 m (margin 0.05). Dùng state các robot trước từng bước, không chỉ snapshot đầu/cuối; đứng yên là hợp lệ. |
| `lift_floors(lift_id)` | Tập tầng lift phục vụ theo layout; mô hình hiện tại là tầng 1 và 2. |
| `lift_queue_position_reached(robot, lift)` | Chặng tới điểm xếp hàng của lift đã hoàn tất hoặc được engine chấp nhận gần sảnh (còn tối đa 2 ô khi bị chặn), runtime.target == null; không chấp nhận null do lập tuyến thất bại. |
| `lift_stopped_and_level(lift)` | Lift.floor xác định, lift.y bằng cao độ tầng (`_elev_of`), không còn chuyển động/leveling; kiểm tra cùng pha mở cửa trong biểu thức. |
| `cabin_boarded(lift)` | Occupant đã hoàn tất `_micro_move` tới `_lift_cabin`, có chuyển tiếp ROBOT_BOARDED của chuyến hiện tại, không chỉ được reserved. |
| `exit_clear(lift)` | Robot của chuyến hiện tại đã hoàn tất tuyến ra `_pick_lift_exit` qua các pha TURN_OUT/OUT/TURN_EXIT/GO và ra hoàn toàn khỏi cabin/vùng cửa; dùng trace thực tế `_handle_lift`, không chỉ occupant == null. |
| `door(lift, floor)` | floor == 1 trả door_f1, floor == 2 trả door_f2. Dùng tầng lưu trước khi đóng vì floor hiện tại có thể đã thành null khi thang khởi hành. |
| `other_floor(floor)` | 1 → 2, 2 → 1 trong layout thang hiện tại. |
| `lift_exit_seen(robot_id, lift_id, floor)` | ROBOT_EXITED mới của lần chạy, đúng robot và trace `_handle_lift` gắn đúng lift cùng tầng đích. Event hiện chỉ có robot_id có cấu trúc; lift_id và floor phải lấy từ trace tại lúc emit, không giả định event có hai trường đó hoặc dựa vào thông báo tự do để kết luận. |
| `congestion_level(zone_id)` | Mức `engine.congested_zones[zone_id].level` đang áp dụng tại `_update_zones`; bằng 0 khi xác nhận không có injection. Không thay lỗi đọc dữ liệu bằng 0. |
| `block_record(zone_id, start_tick)` | Bản ghi state.people có ID `VLM-{zone_id}-{start_tick}` do đúng lần `block_zone` tạo; zone phải khớp. |
| `affected_routes_notified(zone_id, initial_snapshot)` | Với vùng chưa bị block trước thao tác: mọi robot có phần path còn lại giao bounds đã được `_set_fsm(..., "OBSTACLE_DETECTED")` trong `block_zone`. Với vùng đã block, engine không phát lại: cần trace phong tỏa trước còn hiệu lực và bằng chứng các tuyến bị ảnh hưởng đã được thông báo; không tự coi đạt chỉ vì lần gọi mới không đổi FSM. |
| `observation_input_bound(frame_id, camera_id)` | frame_id xác định duy nhất lần quan sát camera trong context, có ảnh hoặc snapshot mô phỏng; snapshot state được giữ trước `observe` như `post_vlm`. Đây là liên kết tại tầng task, API VLM hiện không có frame_id. |
| `observation_for(observation, frame_id)` | Observation chính là kết quả trả về của lần gọi đã gắn frame_id, không phải kết quả trước đó/camera khác hoặc lần gọi đồng thời. Dùng liên kết request/response và dấu vết ghi Camera.last_observation. |

## Căn cứ trong WareTwin

Đối chiếu với repository `../WareTwin`, chủ yếu:

- `backend/app/sim/engine.py`: `_step_robot`, `_complete_task`, `_move_along_path`,
  `_go_charge`, `_step_lifts`, `_handle_lift`, `clear_injection`, `_update_devices`,
  `_update_zones`, `block_zone`, `create_task` và `_apply_injections`.
- `backend/app/sim/rules.py`: quy tắc nguồn/đích theo loại lệnh kho.
- `backend/app/schema.py`: tên trường, enum và miền dữ liệu.
- `backend/app/main.py::post_vlm` và `backend/app/ai/vlm.py`: đầu vào/kết quả VLM.

Các quyết định quan trọng:

- PICK thêm ràng buộc tải không vượt sức chứa để bảo đảm lấy **đủ** hàng.
  Engine hiện lấy `min(capacity, load_units)`; việc lưu Pre chưa bổ sung guard
  này vào engine.
- NAVIGATE/PICK/DROP dùng điểm phục vụ mà engine chấp nhận: engine có thể cho
  làm việc ở ô gần trạm khi xếp hàng, nên không buộc tọa độ trùng tuyệt đối.
- RECHARGE dùng ngưỡng cố định **95%** của engine. Robot IDLE có thể đi sạc
  khi pin dưới **35%**. Ngưỡng **>20%** là điều kiện phân công nhiệm vụ của
  Fleet Manager, không phải điều kiện tạo `T_ORDER_*` hay mọi chặng di chuyển.
- `T_ORDER_*` hoàn tất khi **tạo** nhiệm vụ `WAITING`; vận chuyển xong được
  xác minh bởi DROP. Không yêu cầu có robot rảnh mới được tạo đơn.
- LIFT_RECOVER tiếp tục pha bị đóng băng; Post không ép thang về IDLE.
- STOP_BELT dựa trên xử lý lỗi thực tế: trạng thái `ERROR`, tốc độ và thông
  lượng về 0. RUN_BELT dùng tốc độ cấu hình khi khôi phục, không giả định engine
  đã có API đặt tốc độ tùy ý.
- SENSOR_REPORT giới hạn vào bốn loại sensor hiện được `_update_devices`
  cập nhật. Enum `IR` có trong schema nhưng chưa có nhánh cập nhật tương ứng.
- VLM có thể trả `event == none`; phong tỏa tự động còn phụ thuộc
  `TWIN_VLM_ACTS`, nên không coi phong tỏa là Post bắt buộc của nhận diện.
- `T_FLEET_COLLECT_ENERGY` là hợp đồng thu thập một snapshot gồm `id`, `battery`
  cho toàn bộ robot, kể cả OFFLINE. Handler cho task này nằm ngoài seed KG.

## Cập nhật Neo4j hiện tại

Từ thư mục gốc, dùng Python có driver Neo4j và `python-dotenv`:

```bash
smart_kettle_simulator/.venv/bin/python cypher/migrate_task_conditions.py --validate-only
smart_kettle_simulator/.venv/bin/python cypher/migrate_task_conditions.py
smart_kettle_simulator/.venv/bin/python cypher/migrate_task_conditions.py --apply
```

Migration dùng cấu hình `NEO4J_*` qua `seed_neo4j.load_config`, đọc cùng định
nghĩa với seed, yêu cầu mỗi Task ID tồn tại đúng một lần, cập nhật hai thuộc
tính trong một transaction và so sánh graph trước/sau. Lỗi kiểm tra trong
transaction sẽ rollback. Chạy lại khi đã khớp sẽ báo `Updated 0 tasks`.

Trước khi áp dụng, chạy `python3 -m unittest discover -s cypher/tests` và
`python3 cypher/seed_neo4j.py --validate-only`. Các test điều kiện kiểm tra cú
pháp đặc tả, biến được ràng buộc, số đối số/định nghĩa predicate, mốc Post và
các ràng buộc định danh/thời gian quan trọng. Kiểm tra cú pháp chỉ phân tích
cấu trúc, không thực thi biểu thức. `migrate_task_conditions.py --validate-only`
kiểm tra độ bao phủ và khả năng trích xuất từ seed, không thay thế bộ test.

Kiểm tra nội dung trên Neo4j:

```cypher
MATCH (:Goal)-[:OPERATIONALIZED_BY]->(t:Task)
WHERE t.id STARTS WITH 'T_R_' OR t.id STARTS WITH 'T_LIFT_'
   OR t.id STARTS WITH 'T_BELT_' OR t.id STARTS WITH 'T_ZONE_'
   OR t.id STARTS WITH 'T_ORDER_'
   OR t.id IN ['T_VLM_DETECT', 'T_SENSOR_REPORT', 'T_FLEET_COLLECT_ENERGY']
RETURN DISTINCT t.id, t.precondition, t.postcondition
ORDER BY t.id;
```

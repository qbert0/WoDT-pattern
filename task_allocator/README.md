# WareTwin task allocator

Module phân công đơn vận chuyển: đọc contract từ Neo4j, lọc và chấm điểm robot
trên snapshot Ditto, rồi gửi quyết định cho Fleet Manager của WareTwin.
Fleet Manager kiểm tra lại trạng thái và gán việc; FSM hiện có tiếp tục thực thi.

Yêu cầu Python 3.10+, Neo4j đã có [topology WareTwin](../cypher/waretwin_ditto_mapping.md),
Ditto nhận telemetry qua MQTT, và backend WareTwin hỗ trợ feature `dispatch`,
`GET /api/layout`, `POST /api/fleet/assignments` (module `app/allocation.py`).
Backend WareTwin cũ chưa có các giao diện này sẽ không chạy được allocator.

Chạy các lệnh sau từ root WoDT-pattern:

```bash
python3 -m venv task_allocator/.venv
task_allocator/.venv/bin/pip install -r task_allocator/requirements.txt
cp task_allocator/.env.example task_allocator/.env
```

Điền cấu hình trong `.env`: thông tin kết nối Neo4j, Ditto, WareTwin và
`FLEET_API_KEY` dùng chung với backend. Namespace phải khớp bridge MQTT và mapping
robot trong Neo4j. Module không tự đọc `.env`; nạp biến vào shell trước khi chạy:

```bash
set -a
. task_allocator/.env
set +a

# Xem Cypher trước khi áp dụng contract tùy chọn T_ORDER_ASSIGN:
task_allocator/.venv/bin/python -m task_allocator.seed
task_allocator/.venv/bin/python -m task_allocator.seed --apply
```

Seed chỉ bổ sung contract phân công sau topology nền. Chạy lại sẽ khôi phục các
expression chuẩn trong [file seed](../cypher/waretwin_allocation.cypher).

Backend phải bật `TWIN_MQTT_ENABLED=1`. Với chế độ `TWIN_ALLOCATION_MODE=internal`,
bật thêm `TWIN_DISPATCH_SNAPSHOT=1` để thử `--shadow`; chế độ này chỉ đọc và ghi log,
không gửi quyết định. Snapshot có thể không còn đơn chờ vì allocator nội bộ đã gán.

```bash
task_allocator/.venv/bin/python -m task_allocator --shadow

# Khi backend chạy TWIN_ALLOCATION_MODE=external và dùng cùng FLEET_API_KEY:
task_allocator/.venv/bin/python -m task_allocator
```

Mặc định đọc snapshot mỗi 0,5 giây và từ chối snapshot quá 5 giây. Contract Neo4j
được tải lúc khởi động; cần restart allocator sau khi sửa contract. Khi allocator
dừng trong chế độ external, đơn mới sẽ chờ, các đơn đã giao vẫn tiếp tục thực thi.

Kiểm thử evaluator và trách nhiệm agent không cần dịch vụ đang chạy:

```bash
python3 -m unittest task_allocator.tests.test_allocator.Conditions -v
```

Để chạy đủ 6 test, gồm parity và mô phỏng đến `COMPLETED`, đặt repo WareTwin cùng
cấp với WoDT-pattern và dùng môi trường Python đã cài dependency backend:

```bash
../WareTwin/backend/.venv/bin/python -m unittest discover -s task_allocator/tests -v
```

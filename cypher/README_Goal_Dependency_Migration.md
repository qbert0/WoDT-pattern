# Chuyển phân rã khác agent thành dependency

`REFINES {type: 'AND'|'OR'}` chỉ phân rã goal trong cùng agent phụ trách.
Nếu goal con thuộc agent khác, goal cha dùng `DEPENDS_ON {type: 'ACHIEVED'}`
hướng tới goal con. `DELEGATED_TO`, goal, task và điều kiện thực thi giữ nguyên.

Agent được xác định bằng phân công trực tiếp, hoặc tổ tiên được phân công gần
nhất qua `REFINES`. Migration tính toàn bộ agent trên snapshot ban đầu trước
khi thay cạnh. Thiếu agent hoặc nhiều agent cùng khoảng cách sẽ báo lỗi trước
khi ghi. Phân rã OR khác agent cũng được báo rõ để mô hình hóa lựa chọn riêng;
không tự biến lựa chọn OR thành điều kiện bắt buộc ACHIEVED.

## Xem trước và áp dụng

Chạy từ repo root với Python có `neo4j` và `python-dotenv`. Cấu hình dùng chung
`load_config()` của seed: biến môi trường rồi đến `.env` của simulator. Không
cần chạy lại seed hoặc thay đổi dữ liệu Ditto.

```bash
smart_kettle_simulator/.venv/bin/python cypher/migrate_goal_dependencies.py
smart_kettle_simulator/.venv/bin/python cypher/migrate_goal_dependencies.py --apply --journal /tmp/wodt-goal-dependencies.json
```

Mặc định chỉ đọc. `--apply` lưu snapshot cùng kế hoạch vào journal quyền `0600`
trước khi ghi Neo4j. Giữ journal ở nơi riêng ngoài git và giữ lại để khôi phục.
Trong lúc migration hoặc rollback, tạm dừng sửa KG/seed để tránh thay đổi đồng
thời. Migration đối chiếu toàn bộ graph trước/sau và commit tất cả cạnh trong
một transaction. Nó không tạo hoặc xóa node.

Hiện có năm cạnh AND cần đổi:

| Goal cha | Goal con | Agent của goal con |
|---|---|---|
| `G_WT_FULFILL_OPERATIONS` | `G_WT_TRANSPORT` | `A_ROBOT` |
| `G_WT_FULFILL_OPERATIONS` | `G_WT_CROSSFLOOR` | `A_LIFT` |
| `G_WT_SAFETY` | `G_Z_MAINTAIN_SAFE_TRAFFIC` | `A_ZONE` |
| `G_WT_SAFETY` | `G_P_PROVIDE_SITUATIONAL_AWARENESS` | `A_PERCEPTION` |
| `G_WT_INFRA` | `G_CV_PROVIDE_MATERIAL_FLOW` | `A_CONVEYOR` |

Cả năm goal cha thuộc `A_WARETWIN`. Coffee đã dùng dependency đúng ranh giới
agent nên không đổi. Chạy lại lệnh apply với cùng journal là no-op nếu graph
đã ở trạng thái mong muốn. Chạy preview mới sau migration sẽ báo 0 cạnh cần đổi.
Dependency ACHIEVED có sẵn được tái sử dụng; thuộc tính ngoài `type` được giữ.
Nếu thuộc tính xung đột hoặc có cạnh trùng thì migration báo lỗi, không tự ghi đè.

## Khôi phục

```bash
smart_kettle_simulator/.venv/bin/python cypher/migrate_goal_dependencies.py --rollback --journal /tmp/wodt-goal-dependencies.json
```

Rollback khôi phục loại cạnh và thuộc tính ban đầu; relationship ID do Neo4j
cấp lại có thể khác. Dependency có sẵn được phục hồi, chỉ dependency do migration
tạo mới bị xóa. Nếu graph đã thay đổi sau snapshot, rollback dừng để tránh ghi
đè dữ liệu mới. Sau rollback, dùng journal mới nếu muốn apply lại.

## Kiểm chứng

- Giữ nguyên 44 Goal, 28 Task, 9 Agent và tất cả thuộc tính node/phân công.
- Năm cạnh mới là `DEPENDS_ON ACHIEVED`, không còn `REFINES` cùng cặp goal.
- Warehouse có 5 goal, 1 agent, 5 task trong cây nội bộ. Cây Robot có 10 goal,
  6 task; Lift có 7 goal, 4 task. Các cây thành phần khác giữ nguyên.
- UI hierarchy/target chỉ theo `REFINES`; phần phối hợp hiện dependency trực tiếp.
  Owner không được kế thừa qua dependency. Trình sửa graph thủ công không tự đổi cạnh.

```bash
smart_kettle_simulator/.venv/bin/python -m unittest discover -s cypher/tests -v
cd client-aplication
RUN_GOAL_GRAPH_TESTS=1 npm test
npm run build
```

Kiểm thử tích hợp Python chỉ bật khi có `NEO4J_TEST_URI`, `NEO4J_TEST_USER`,
`NEO4J_TEST_PASSWORD` trỏ đến Neo4j thử nghiệm **rỗng**. Suite từ chối database
có dữ liệu, seed mới, kiểm tra seed chạy lại, migration, rollback và dữ liệu
không đổi. Các thay đổi trong từng test được rollback. Không dùng cấu hình
database ứng dụng cho các biến `NEO4J_TEST_*`.

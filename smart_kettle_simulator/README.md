# Smart Kettle Simulator

Project duoc tinh gon theo 4 module chinh:

- `kettle_simulator`: gia lap am dun nuoc khi chua co thiet bi that.
- `core`: chua logic nghiep vu, xu ly state, format payload, nhan command dieu khien vat.
- `ditto_client`: gui telemetry len Eclipse Ditto qua MQTT va nhan command tra ve.
- `neo4j_module`: truy van knowledge graph trong Neo4j de kiem tra capability va command.

## Cau truc

```text
smart_kettle_simulator/
|-- core/
|-- kettle_simulator/
|-- ditto_client/
|-- neo4j_module/
|-- scripts/
|-- tests/
|-- .env
|-- main.py
`-- requirements.txt
```

## Luong du lieu

```text
Kettle Simulator -> Core -> Ditto MQTT -> Eclipse Ditto
Eclipse Ditto -> Ditto MQTT -> Core -> Kettle Simulator
Core -> Neo4j Module -> Neo4j
```

## Vai tro tung module

### 1. `kettle_simulator`

Module nay gia lap hanh vi cua am dun nuoc:

- tang giam nhiet do
- bat tat nguon
- dat nhiet do muc tieu
- phat sinh state moi theo thoi gian

Trong thuc te, module nay se duoc thay bang firmware hoac service tren thiet bi am nuoc that.

### 2. `core`

Module trung tam cua he thong:

- nhan state tu simulator
- luu state hien tai
- format du lieu theo schema Ditto
- nhan command dieu khien
- kiem tra command qua Neo4j neu can
- goi lai simulator de thay doi trang thai vat ly

### 3. `ditto_client`

Module giao tiep voi Eclipse Ditto qua MQTT:

- gui state len Ditto
- subscribe topic command
- nhan command tu Ditto
- tra response sau khi command duoc xu ly

### 4. `neo4j_module`

Module repository truy van Neo4j:

- lay capability cua am
- kiem tra command co duoc phep hay khong
- ho tro doc knowledge graph cho phan nghiep vu

## Cach chay

### 1. Tao moi truong va cai dependency

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\smart_kettle_simulator\requirements.txt
```

### 2. Cau hinh `.env`

Chinh file [`.env`](/e:/code/Muti-agent-app/WoDT-test/smart_kettle_simulator/.env:1):

- `THING_ID`
- `SIMULATION_INTERVAL`
- `DITTO_MQTT_HOST`
- `DITTO_MQTT_PORT`
- `DITTO_MQTT_USERNAME`
- `DITTO_MQTT_PASSWORD`
- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`

Neu khong dung Neo4j, he thong van chay. Luc do phan validate command qua graph se tu dong bi bo qua khi ket noi that bai.

### 3. Chay gia lap

```powershell
python -m smart_kettle_simulator.scripts.run_simulation
```

Hoac:

```powershell
python -m smart_kettle_simulator.main
```

### 4. Lenh dieu khien trong terminal

- `on`
- `off`
- `temp 95`
- `status`
- `quit`

## Seed Neo4j

File Cypher nam tai [neo4j_module/kettle_graph.cypher](/e:/code/Muti-agent-app/WoDT-test/smart_kettle_simulator/neo4j_module/kettle_graph.cypher:1).

Co the mo Neo4j Browser va chay script nay de tao capability graph.

## Test

```powershell
pip install pytest
pytest .\smart_kettle_simulator\tests
```

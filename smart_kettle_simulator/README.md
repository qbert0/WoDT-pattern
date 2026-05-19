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
Kettle Simulator -> MQTT Broker -> Digital Twin App -> Eclipse Ditto
Eclipse Ditto -> Digital Twin App -> MQTT Broker -> Kettle Simulator
Digital Twin App -> Neo4j Module -> Neo4j
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

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r smart_kettle_simulator/requirements.txt
```

### 2. Cau hinh `.env`

Chinh file `.env`:

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

Mac dinh demo hien tai dung:

```text
MQTT_HOST=35.240.154.27
DITTO_MQTT_HOST=35.240.154.27
DITTO HTTP API=http://35.240.154.27:8080/api/2
THING_ID=smart-home:kettle-01
```

### 3. Chay Digital Twin app

Chay DT truoc de subscribe state tu simulator va dong bo len Ditto:

```bash
source .venv/bin/activate
python -m smart_kettle_simulator.scripts.run_digital_twin
```

Log mong doi:

```text
[MQTTBridge] Twin listening on kettle/smart-home:kettle-01/state and kettle/smart-home:kettle-01/responses
[DittoBridge] Listening on smart-home/kettle-01/things/live/messages/+
dt>
```

### 4. Chay Kettle Simulator

Mo terminal khac va chay:

```bash
source .venv/bin/activate
python -m smart_kettle_simulator.scripts.run_simulation
```

Log mong doi:

```text
[MQTTBridge] Device listening on kettle/smart-home:kettle-01/commands
sim>
```

Lenh dieu khien tai prompt `sim>`:

- `on`
- `off`
- `temp 95`
- `water 80`
- `status`
- `quit`

DT se nhan state tu MQTT broker va cap nhat Ditto features:

```text
features.power.properties.status
features.water.properties.temperature
features.water.properties.waterLevel
features.water.properties.targetTemperature
```

### 5. Kiem tra Ditto

```bash
curl -u ditto:ditto \
  -H "Accept: application/json" \
  "http://35.240.154.27:8080/api/2/things/smart-home:kettle-01"
```

### 6. Giao dien Digital Twin

`digital_twin_app` la CLI runtime, khong co web UI rieng. Web UI nam trong `client-aplication/`:

```bash
cd client-aplication
npm install
npm run dev
```

Mo:

```text
http://localhost:5173
http://localhost:5173/dt/smart-home%3Akettle-01
```

## Seed Neo4j

File Cypher nam tai [neo4j_module/kettle_graph.cypher](/e:/code/Muti-agent-app/WoDT-test/smart_kettle_simulator/neo4j_module/kettle_graph.cypher:1).

Co the mo Neo4j Browser va chay script nay de tao capability graph.

## Test

```bash
pip install pytest
pytest smart_kettle_simulator/tests
```

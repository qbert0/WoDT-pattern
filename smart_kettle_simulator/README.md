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
Kettle Simulator -> kettle/.../state -> Digital Twin App
Digital Twin App -> twin/commands/modify -> Eclipse Ditto

Eclipse Ditto -> live/messages/{subject} -> Digital Twin App
Digital Twin App -> kettle/.../commands -> Kettle Simulator
Digital Twin App -> live/messages/{subject}/response -> Eclipse Ditto

Digital Twin App -> Neo4j Module -> Neo4j
```

DT app tra Ditto response `2xx` ngay sau khi forward command sang topic noi bo cua
simulator. Response nay chi xac nhan lenh da duoc forward, khong xac nhan trang
thai vat ly cuoi cung. Simulator phat state moi sau do va DT app dong bo state nay
bat dong bo len Ditto twin.

## MQTT topic contract

Voi `THING_ID=smart-home:kettle-01`, cac topic duoc chia thanh hai nhom:

| Huong | Topic | Muc dich |
| --- | --- | --- |
| Simulator -> DT app | `kettle/smart-home:kettle-01/state` | State thuc cua simulator |
| DT app -> simulator | `kettle/smart-home:kettle-01/commands` | Command va params |
| Simulator -> DT app | `kettle/smart-home:kettle-01/responses` | Ket qua xu ly noi bo |
| DT app -> Ditto | `smart-home/kettle-01/things/twin/commands/modify` | Cap nhat attributes/features |
| Ditto -> DT app | `smart-home/kettle-01/things/live/messages/{subject}` | Live message request |
| DT app -> Ditto | `smart-home/kettle-01/things/live/messages/{subject}/response` | Ditto Protocol response |

DT app chi subscribe `smart-home/kettle-01/things/live/messages/+`. MQTT wildcard
`+` chi khop mot level, nen response topic co them level `/response` khong bi DT
app nhan lai. Khong doi subscription thanh `live/messages/#`, vi wildcard do se
bat ca request va response, co the tao message loop.

Subject command hien duoc ho tro:

- `turn_on`
- `turn_off`
- `set_target_temperature` voi `{"temperature": 95}`
- `set_water_level` voi `{"water_level": 80}`

Ditto Protocol `correlation-id` nam trong truong `headers` cua JSON payload khi
dung MQTT 3.1.1. DT app copy nguyen header nay sang response. Response path duoc
tao tu request path bang cach doi `/inbox/messages/` thanh
`/outbox/messages/`, nen ho tro ca Thing inbox va Feature inbox.

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
MQTT_HOST=34.143.166.45
DITTO_MQTT_HOST=34.143.166.45
DITTO HTTP API=http://34.143.166.45:8080/api/2
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

### 5. Tao hoac cap nhat Ditto MQTT connection

Connection mau nam tai `mqtt_project/ditto_connection.json`. Sua `uri` trong file
cho dung broker, sau do tao connection:

```bash
export DITTO_HTTP_API=http://34.143.166.45:8080/api/2
export DITTO_USER=ditto
export DITTO_PASSWORD=ditto

curl -u "$DITTO_USER:$DITTO_PASSWORD" \
  -X POST \
  -H "Content-Type: application/json" \
  --data @mqtt_project/ditto_connection.json \
  "$DITTO_HTTP_API/connections"
```

Neu connection da ton tai, cap nhat theo ID:

```bash
export CONNECTION_ID=<connection-id>

curl -u "$DITTO_USER:$DITTO_PASSWORD" \
  -X PUT \
  -H "Content-Type: application/json" \
  --data @mqtt_project/ditto_connection.json \
  "$DITTO_HTTP_API/connections/$CONNECTION_ID"
```

Connection dung built-in payload mapping `Ditto`, MQTT 3.1.1 va hai source:

```text
smart-home/kettle-01/things/twin/commands/modify
smart-home/kettle-01/things/live/messages/+/response
```

Target selector cho phien ban Ditto dang chay la `_/_/things/live/messages`.
Khong dung `_/_/things/twin/events`: twin events chi thong bao thay doi twin, khong forward
command toi simulator. `twin/messages/#` cung khong tham gia hai luong cua demo.
Target address dung `{{ topic:subject }}` de lay subject command tu Ditto Protocol
topic.

Policy cua Thing phai cap authorization context `nginx:ditto` quyen `READ` cho
target doc live message va `WRITE` cho source cap nhat twin/dua message response
tro lai Ditto. Neu thieu quyen, connection van co the ket noi broker nhung Ditto
se tu choi xu ly message.

### 6. Kiem tra Ditto twin

```bash
curl -u ditto:ditto \
  -H "Accept: application/json" \
  "http://34.143.166.45:8080/api/2/things/smart-home:kettle-01"
```

### 7. Kiem tra live commands end-to-end

Khoi dong DT app va simulator, sau do theo doi toan bo topic cua Thing tren mot
terminal rieng:

```bash
mosquitto_sub -h 34.143.166.45 -p 1883 -v \
  -t 'smart-home/kettle-01/things/#'
```

Gui `turn_on` qua Thing inbox:

```bash
curl -i -u ditto:ditto \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{}' \
  "http://34.143.166.45:8080/api/2/things/smart-home:kettle-01/inbox/messages/turn_on?channel=live&timeout=10"
```

Gui `set_target_temperature` qua Feature inbox:

```bash
curl -i -u ditto:ditto \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"temperature":95}' \
  "http://34.143.166.45:8080/api/2/things/smart-home:kettle-01/features/water/inbox/messages/set_target_temperature?channel=live&timeout=10"
```

Caller phai nhan response `2xx`. Sau khi simulator phat state moi, doc lai Thing
va kiem tra `features.water.properties.targetTemperature=95`. Tren broker, moi
command chi co mot request topic va mot response topic; khong duoc thay cac topic
lap lai lien tuc. Query parameter `channel=live` la bat buoc de message khop target
selector `_/_/things/live/messages`; neu bo qua, Ditto gui message tren twin channel
va caller se timeout.

Checklist day du:

1. Thay doi state tai simulator va xac nhan cac feature trong Ditto duoc cap nhat.
2. Gui `turn_on` qua Thing inbox va xac nhan simulator bat.
3. Gui Feature inbox command dat target temperature thanh `95`.
4. Xac nhan caller nhan `2xx` va twin cap nhat target temperature sau state moi.
5. Quan sat broker de bao dam moi command chi xuat hien mot lan, khong loop.

### 8. Giao dien Digital Twin

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

File Cypher nam tai `smart_kettle_simulator/neo4j_module/kettle_graph.cypher`.

Co the mo Neo4j Browser va chay script nay de tao capability graph.

## Test

```bash
pip install pytest
python -m pytest smart_kettle_simulator/tests
```

Tai lieu protocol tham khao:

- [Eclipse Ditto Messages protocol](https://eclipse.dev/ditto/protocol-specification-things-messages.html)
- [Eclipse Ditto MQTT binding](https://eclipse.dev/ditto/connectivity-protocol-bindings-mqtt.html)

# Smart Grinder Simulator

Mo hinh nay tach thanh 2 app doc lap:

- `simulator_app`: gia lap may xay ca phe
- `digital_twin_app`: nhan state, day len Ditto, nhan command tu Ditto

Command chinh cua grinder:

- `grind`
- `stop`
- `set_bean_amount`

State chinh:

- `power_status`
- `grinder_status`
- `bean_amount`
- `target_amount`
- `grind_complete`

Cau hinh MQTT cloud trong `smart_grinder_simulator/.env`:

```dotenv
MQTT_HOST=34.143.166.45
MQTT_PORT=1883
MQTT_USERNAME=mqtt-user
MQTT_PASSWORD=mqtt-password
DITTO_MQTT_HOST=34.143.166.45
DITTO_MQTT_PORT=1883
DITTO_MQTT_USERNAME=mqtt-user
DITTO_MQTT_PASSWORD=mqtt-password
```

Port `8081` cua `ditto-ambassador` chi nhan HTTP, khong phai MQTT. Ditto MQTT
Connection duoc tao qua script `ditto-ambassador/scripts/create-grinder-mqtt-connection.sh`.

Chay simulator:

```powershell
python -m smart_grinder_simulator.scripts.run_simulation
```

Chay digital twin:

```powershell
python -m smart_grinder_simulator.scripts.run_digital_twin
```

Seed Neo4j:

```powershell
python -m smart_grinder_simulator.scripts.seed_neo4j
```

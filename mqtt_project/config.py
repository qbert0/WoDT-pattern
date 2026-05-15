# config.py
# Cấu hình MQTT Broker cho simulator (vẫn giữ nguyên)
SIMULATOR_MQTT_BROKER = "localhost"
SIMULATOR_MQTT_PORT = 1884

# ⚠️ QUAN TRỌNG: Ditto connection đang dùng IP 192.168.100.235
DITTO_MQTT_BROKER = "http://35.240.154.27"  # Sửa từ 100.125.2.64 thành IP đúng
DITTO_MQTT_PORT = 1883

# Cấu hình Ditto API (vẫn giữ nguyên)
DITTO_URL = "http://35.240.154.27:8080/api/2"
USERNAME = "ditto"
PASSWORD = "ditto"

# Cấu hình Neo4j (vẫn giữ nguyên)
NEO4J_URI = "bolt://35.240.154.27:7687"  
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "password123"

# Thing ID
THING_ID = "smart-home:kettle-01"

# Các topic MQTT - ĐÃ SỬA ĐỂ PHÙ HỢP VỚI CONNECTION
TOPIC_SIMULATOR_STATUS = "kettle/simulator/status"
TOPIC_SIMULATOR_COMMAND = "kettle/simulator/command"

# ⚠️ QUAN TRỌNG: Topic gửi lên Ditto phải match với source của connection
# Connection subscribe: ditto/things/#
# Nên ta gửi dữ liệu lên: ditto/things/smart-home:kettle-01/features/water/properties/temperature
TOPIC_DITTO_TELEMETRY = f"ditto/things/{THING_ID}/features/water/properties/temperature"

# Topic nhận lệnh từ Ditto (match với target của connection)
# Target gửi xuống: ditto/things/{{thing:id}}/inbox/messages/{{header}}
TOPIC_DITTO_COMMAND = f"ditto/things/{THING_ID}/inbox/messages/+"
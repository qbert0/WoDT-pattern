import paho.mqtt.client as mqtt
import json
import random
import time
import threading
from datetime import datetime
import requests
import uuid
import signal
import sys

# Cấu hình MQTT Broker
MQTT_BROKER_LOCAL = "localhost"
MQTT_PORT_LOCAL = 1883

# Cấu hình Ditto API
DITTO_URL = "http://100.104.220.45:8080/api/2"
USERNAME = "ditto"
PASSWORD = "ditto"

# Cấu hình Ditto gửi đến MQTT
DITTO_MQTT_BROKER = "100.125.2.64"
DITTO_MQTT_PORT = 1883

# Thing ID từ JSON của bạn
THING_ID = "smart-home:kettle-01"

class SmartKettleSimulator:
    """Mô phỏng ấm đun nước thông minh với nhiệt độ thay đổi liên tục"""
    
    def __init__(self):
        self.thing_id = THING_ID
        self.running = True
        
        # Trạng thái hiện tại của Thing (đúng cấu trúc Ditto)
        self.current_state = {
            "power": {
                "properties": {
                    "status": "off",
                    "powerConsumption": 0
                }
            },
            "water": {
                "properties": {
                    "temperature": 95.0,
                    "waterLevel": 85,
                    "capacity": 1.7,
                    "currentVolume": 1.7
                }
            },
            "status": {
                "properties": {
                    "state": "heating",
                    "lastActive": datetime.now().isoformat(),
                    "remainingTime": 0,
                    "targetTemperature": 100
                }
            },
            "statistics": {
                "properties": {
                    "totalBoils": 0,
                    "totalUptime": 0,
                    "lastMaintenance": "2024-12-01"
                }
            }
        }
        
        # Kết nối MQTT
        self.mqtt_client = None
        self.connect_mqtt()
        
        # Biến để theo dõi nhiệt độ
        self.temperature_direction = 1
        self.last_temperature_update = time.time()
        
    def connect_mqtt(self):
        """Kết nối đến MQTT Broker"""
        try:
            self.mqtt_client = mqtt.Client(client_id=f"kettle_simulator_{uuid.uuid4().hex[:8]}")
            self.mqtt_client.on_connect = self.on_mqtt_connect
            self.mqtt_client.on_message = self.on_mqtt_message
            
            print(f"[MQTT] Đang kết nối đến {MQTT_BROKER_LOCAL}:{MQTT_PORT_LOCAL}...")
            self.mqtt_client.connect(MQTT_BROKER_LOCAL, MQTT_PORT_LOCAL, 60)
            self.mqtt_client.loop_start()
            
            time.sleep(1)
            return True
        except Exception as e:
            print(f"[ERROR] Không thể kết nối MQTT: {e}")
            return False
    
    def on_mqtt_connect(self, client, userdata, flags, rc):
        """Callback khi kết nối MQTT thành công"""
        if rc == 0:
            print(f"[MQTT] ✓ Kết nối thành công đến broker")
            subscribe_topic = f"ditto/things/{self.thing_id}/inbox/messages/+"
            client.subscribe(subscribe_topic)
            print(f"[MQTT] Đang lắng nghe topic: {subscribe_topic}")
            
            # Gửi toàn bộ trạng thái ban đầu
            self.send_full_state_to_ditto()
        else:
            print(f"[MQTT] Kết nối thất bại với mã lỗi: {rc}")
    
    def on_mqtt_message(self, client, userdata, msg):
        """Xử lý lệnh từ Ditto gửi xuống qua MQTT"""
        try:
            payload = json.loads(msg.payload.decode())
            print(f"\n[MQTT COMMAND] Nhận lệnh từ Ditto:")
            print(f"  Topic: {msg.topic}")
            
            # Xử lý command
            if "value" in payload:
                command = payload["value"]
                if "setTemperature" in command:
                    self.set_target_temperature(command["setTemperature"])
                elif "turnOn" in command:
                    self.turn_on()
                elif "turnOff" in command:
                    self.turn_off()
                    
        except Exception as e:
            print(f"[ERROR] Xử lý lệnh MQTT thất bại: {e}")
    
    def send_single_feature_to_ditto(self, feature_id, property_path, value):
        """Gửi cập nhật một thuộc tính lên Ditto"""
        url = f"{DITTO_URL}/things/{self.thing_id}/features/{feature_id}/properties/{property_path}"
        
        try:
            response = requests.put(
                url,
                auth=(USERNAME, PASSWORD),
                headers={"Content-Type": "application/json"},
                json=value,
                timeout=5
            )
            
            if response.status_code in [200, 201, 204]:
                return True
            else:
                print(f"[DITTO API] Lỗi cập nhật {feature_id}/{property_path}: {response.status_code}")
                return False
        except Exception as e:
            print(f"[DITTO API] Không thể kết nối: {e}")
            return False
    
    def send_full_state_to_ditto(self):
        """Gửi toàn bộ trạng thái lên Ditto - Cách 1: Gửi từng feature"""
        print(f"\n[DITTO] Đang đồng bộ toàn bộ trạng thái lên Ditto...")
        
        # Gửi từng feature riêng lẻ
        features = self.current_state
        
        # Gửi power feature
        power_properties = features["power"]["properties"]
        for prop, value in power_properties.items():
            self.send_single_feature_to_ditto("power", prop, value)
            time.sleep(0.1)
        
        # Gửi water feature
        water_properties = features["water"]["properties"]
        for prop, value in water_properties.items():
            self.send_single_feature_to_ditto("water", prop, value)
            time.sleep(0.1)
        
        # Gửi status feature
        status_properties = features["status"]["properties"]
        for prop, value in status_properties.items():
            self.send_single_feature_to_ditto("status", prop, value)
            time.sleep(0.1)
        
        # Gửi statistics feature
        stats_properties = features["statistics"]["properties"]
        for prop, value in stats_properties.items():
            self.send_single_feature_to_ditto("statistics", prop, value)
            time.sleep(0.1)
        
        print(f"[DITTO] ✓ Đã đồng bộ xong")
    
    def send_full_state_to_ditto_v2(self):
        """Gửi toàn bộ trạng thái lên Ditto - Cách 2: Gửi cả thing cùng lúc"""
        url = f"{DITTO_URL}/things/{self.thing_id}"
        
        # Chuẩn bị dữ liệu đúng format
        thing_data = {
            "features": self.current_state
        }
        
        try:
            response = requests.put(
                url,
                auth=(USERNAME, PASSWORD),
                headers={"Content-Type": "application/json"},
                json=thing_data,
                timeout=5
            )
            
            if response.status_code in [200, 201, 204]:
                print(f"[DITTO API] ✓ Đã cập nhật toàn bộ thing")
                return True
            else:
                print(f"[DITTO API] ✗ Lỗi: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"[DITTO API] ✗ Không thể kết nối: {e}")
            return False
    
    def send_to_mqtt(self, feature_id, property_path, value):
        """Gửi dữ liệu lên MQTT topic"""
        if not self.mqtt_client:
            return False
        
        topic = f"ditto/things/{self.thing_id}/features/{feature_id}/properties/{property_path}"
        message = {
            "value": value,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            result = self.mqtt_client.publish(topic, json.dumps(message), qos=1)
            return result.rc == mqtt.MQTT_ERR_SUCCESS
        except Exception as e:
            print(f"[ERROR] Lỗi khi gửi MQTT: {e}")
            return False
    
    def update_temperature(self):
        """Cập nhật nhiệt độ dao động từ 90-100°C"""
        current_temp = self.current_state["water"]["properties"]["temperature"]
        
        # Thay đổi nhiệt độ ngẫu nhiên
        change = random.uniform(-0.8, 0.8)
        new_temp = current_temp + change
        
        # Giới hạn trong khoảng 90-100°C
        if new_temp > 100:
            new_temp = 100
            self.temperature_direction = -1
        elif new_temp < 90:
            new_temp = 90
            self.temperature_direction = 1
        
        # Làm tròn 1 chữ số thập phân
        new_temp = round(new_temp, 1)
        
        # Cập nhật nhiệt độ
        self.current_state["water"]["properties"]["temperature"] = new_temp
        
        # Cập nhật trạng thái dựa trên nhiệt độ
        if new_temp >= 99.5:
            self.current_state["status"]["properties"]["state"] = "boiling"
            self.current_state["power"]["properties"]["status"] = "on"
            self.current_state["power"]["properties"]["powerConsumption"] = 1800
            if self.current_state["status"]["properties"]["state"] != "boiling":
                self.current_state["statistics"]["properties"]["totalBoils"] += 1
        elif new_temp >= 95:
            self.current_state["status"]["properties"]["state"] = "heating"
            self.current_state["power"]["properties"]["status"] = "on"
            self.current_state["power"]["properties"]["powerConsumption"] = 1500
        elif new_temp >= 90:
            self.current_state["status"]["properties"]["state"] = "keeping_warm"
            self.current_state["power"]["properties"]["status"] = "on"
            self.current_state["power"]["properties"]["powerConsumption"] = 500
        else:
            self.current_state["status"]["properties"]["state"] = "idle"
            self.current_state["power"]["properties"]["status"] = "off"
            self.current_state["power"]["properties"]["powerConsumption"] = 0
        
        # Cập nhật thời gian
        self.current_state["status"]["properties"]["lastActive"] = datetime.now().isoformat()
        
        return new_temp
    
    def send_updates(self):
        """Gửi cập nhật nhiệt độ lên MQTT và Ditto"""
        # Cập nhật nhiệt độ
        new_temp = self.update_temperature()
        
        # Gửi qua MQTT
        self.send_to_mqtt("water", "temperature", new_temp)
        self.send_to_mqtt("status", "state", self.current_state["status"]["properties"]["state"])
        self.send_to_mqtt("power", "status", self.current_state["power"]["properties"]["status"])
        self.send_to_mqtt("power", "powerConsumption", self.current_state["power"]["properties"]["powerConsumption"])
        
        # Gửi lên Ditto API (cập nhật realtime)
        self.send_single_feature_to_ditto("water", "temperature", new_temp)
        self.send_single_feature_to_ditto("status", "state", self.current_state["status"]["properties"]["state"])
        
        # Mỗi 30 giây gửi cập nhật power consumption
        if random.random() < 0.1:
            self.send_single_feature_to_ditto("power", "powerConsumption", 
                                            self.current_state["power"]["properties"]["powerConsumption"])
        
        # Hiển thị thông tin
        timestamp = datetime.now().strftime("%H:%M:%S")
        temp_bar = "█" * int((new_temp - 90) * 10) + "░" * int((100 - new_temp) * 10)
        print(f"[{timestamp}] 🌡️  Nhiệt độ: {new_temp:.1f}°C [{temp_bar}] | "
              f"Trạng thái: {self.current_state['status']['properties']['state']} | "
              f"Công suất: {self.current_state['power']['properties']['powerConsumption']}W | "
              f"Số lần đun: {self.current_state['statistics']['properties']['totalBoils']}")
    
    def set_target_temperature(self, target_temp):
        """Thiết lập nhiệt độ mục tiêu"""
        target_temp = max(90, min(100, target_temp))
        self.current_state["status"]["properties"]["targetTemperature"] = target_temp
        print(f"\n🎯 Đã đặt nhiệt độ mục tiêu: {target_temp}°C")
        self.send_to_mqtt("status", "targetTemperature", target_temp)
        self.send_single_feature_to_ditto("status", "targetTemperature", target_temp)
    
    def turn_on(self):
        """Bật ấm"""
        self.current_state["power"]["properties"]["status"] = "on"
        print(f"\n🔌 Đã bật ấm đun nước")
        self.send_to_mqtt("power", "status", "on")
        self.send_single_feature_to_ditto("power", "status", "on")
    
    def turn_off(self):
        """Tắt ấm"""
        self.current_state["power"]["properties"]["status"] = "off"
        self.current_state["power"]["properties"]["powerConsumption"] = 0
        print(f"\n💤 Đã tắt ấm đun nước")
        self.send_to_mqtt("power", "status", "off")
        self.send_to_mqtt("power", "powerConsumption", 0)
        self.send_single_feature_to_ditto("power", "status", "off")
        self.send_single_feature_to_ditto("power", "powerConsumption", 0)
    
    def sync_initial_state(self):
        """Đồng bộ trạng thái ban đầu lên Ditto"""
        print("\n[SYNC] Đang đồng bộ trạng thái ban đầu lên Ditto...")
        
        # Cách 1: Gửi từng feature
        success = self.send_full_state_to_ditto()
        
        # Cách 2: Hoặc gửi cả thing (thử cách này nếu cách 1 không hoạt động)
        # success = self.send_full_state_to_ditto_v2()
        
        if success:
            print("[SYNC] ✓ Đồng bộ thành công")
        else:
            print("[SYNC] ✗ Đồng bộ thất bại")
    
    def run(self):
        """Vòng lặp chính mô phỏng"""
        print("\n" + "="*60)
        print("KHỞI ĐỘNG MÔ PHỎNG ẤM ĐUN NƯỚC THÔNG MINH")
        print("="*60)
        print(f"Thing ID: {self.thing_id}")
        print(f"MQTT Broker: {MQTT_BROKER_LOCAL}:{MQTT_PORT_LOCAL}")
        print(f"Ditto API: {DITTO_URL}")
        print("="*60)
        print("Nhiệt độ sẽ dao động liên tục từ 90-100°C")
        print("Nhấn Ctrl+C để dừng chương trình")
        print("="*60)
        
        # Đồng bộ trạng thái ban đầu
        self.sync_initial_state()
        
        print("\n[RUNNING] Bắt đầu mô phỏng...\n")
        
        update_interval = 2  # Cập nhật mỗi 2 giây
        
        try:
            while self.running:
                start_time = time.time()
                
                # Cập nhật và gửi dữ liệu
                self.send_updates()
                
                # Tính thời gian chờ
                elapsed = time.time() - start_time
                sleep_time = max(0, update_interval - elapsed)
                time.sleep(sleep_time)
                
        except KeyboardInterrupt:
            print("\n\n[STOP] Đang dừng mô phỏng...")
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Dọn dẹp khi dừng chương trình"""
        self.running = False
        if self.mqtt_client:
            print("\n[MQTT] Gửi trạng thái cuối cùng...")
            self.send_full_state_to_ditto()
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
            print("[MQTT] Đã ngắt kết nối")
        
        print("[SYSTEM] Kết thúc chương trình\n")


def test_ditto_connection():
    """Kiểm tra kết nối đến Ditto"""
    print("\n[TEST] Kiểm tra kết nối đến Ditto...")
    
    # Kiểm tra thing có tồn tại không
    url = f"{DITTO_URL}/things/{THING_ID}"
    
    try:
        response = requests.get(
            url,
            auth=(USERNAME, PASSWORD),
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        
        if response.status_code == 200:
            print(f"[TEST] ✓ Thing {THING_ID} tồn tại")
            thing_data = response.json()
            print(f"[TEST] Current state: {json.dumps(thing_data, indent=2)}")
            return True
        elif response.status_code == 404:
            print(f"[TEST] ✗ Thing {THING_ID} không tồn tại")
            print(f"[TEST] Bạn cần tạo thing này trước trên Ditto")
            return False
        else:
            print(f"[TEST] ✗ Lỗi: {response.status_code}")
            return False
    except Exception as e:
        print(f"[TEST] ✗ Không thể kết nối: {e}")
        return False


def main():
    """Hàm chính"""
    # Kiểm tra kết nối đến Ditto trước
    if not test_ditto_connection():
        print("\n[ERROR] Không thể kết nối đến Ditto. Vui lòng kiểm tra:")
        print("1. Ditto server có đang chạy không?")
        print("2. Địa chỉ URL có đúng không?")
        print("3. Username/password có đúng không?")
        print("4. Thing đã được tạo chưa?")
        return
    
    # Khởi tạo và chạy simulator
    kettle = SmartKettleSimulator()
    
    # Chạy mô phỏng
    try:
        kettle.run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
# mqtt_bridge.py
import json
import paho.mqtt.client as mqtt
from datetime import datetime
from typing import Dict, Any
import time

class MQTTBridge:
    """Module 3: Kết nối MQTT - Gửi/nhận dữ liệu từ Ditto"""
    
    def __init__(self, broker_host: str, broker_port: int, thing_id: str, on_command_received=None):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.thing_id = thing_id
        self.on_command_received = on_command_received
        
        self.mqtt_client = None
        self.connect()
        
    def connect(self):
        try:
            self.mqtt_client = mqtt.Client(client_id=f"mqtt_bridge_{self.thing_id}")
            self.mqtt_client.on_connect = self._on_connect
            self.mqtt_client.on_message = self._on_message
            
            print(f"[MQTTBridge] Kết nối đến {self.broker_host}:{self.broker_port}")
            self.mqtt_client.connect(self.broker_host, self.broker_port, 60)
            self.mqtt_client.loop_start()
            time.sleep(1)
            return True
        except Exception as e:
            print(f"[MQTTBridge] Lỗi kết nối: {e}")
            return False
    
    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"[MQTTBridge] ✓ Kết nối thành công")
            command_topic = f"ditto/things/{self.thing_id}/inbox/messages/+"
            client.subscribe(command_topic)
            print(f"[MQTTBridge] Đang lắng nghe: {command_topic}")
        else:
            print(f"[MQTTBridge] Kết nối thất bại: {rc}")
    
    def _on_message(self, client, userdata, msg):
        """Nhận message từ MQTT (lệnh từ Ditto)"""
        try:
            payload = json.loads(msg.payload.decode())
            print(f"\n[MQTTBridge] 📨 Nhận lệnh từ Ditto: {json.dumps(payload, ensure_ascii=False)}")
            
            # Lấy reply-to topic để gửi phản hồi
            reply_topic = f"{msg.topic}/response"
            
            if "value" in payload:
                command_value = payload["value"]
                if isinstance(command_value, dict):
                    for cmd, params in command_value.items():
                        if self.on_command_received:
                            self.on_command_received(cmd, params)
                        
                        # GỬI PHẢN HỒI THÀNH CÔNG
                        response = {
                            "status": 200,
                            "message": f"Command {cmd} executed successfully"
                        }
                        client.publish(reply_topic, json.dumps(response), qos=0)
                        print(f"[MQTTBridge] ✓ Đã gửi phản hồi thành công cho lệnh {cmd}")
        except Exception as e:
            print(f"[MQTTBridge] Lỗi: {e}")
            # Gửi phản hồi lỗi
            error_response = {"status": 500, "message": str(e)}
            client.publish(reply_topic, json.dumps(error_response), qos=0)
    
    def send_telemetry(self, ditto_data: Dict[str, Any]):
        """Gửi dữ liệu lên Ditto qua MQTT"""
        if not self.mqtt_client:
            print(f"[MQTTBridge] Chưa kết nối MQTT")
            return False
        
        # Duyệt từng feature
        for feature_id, properties in ditto_data.items():
            # Gửi TOÀN BỘ properties của feature trong 1 message
            topic = f"ditto/things/{self.thing_id}/features/{feature_id}/properties"
            message = {
                "value": properties  # Gửi cả object properties
            }
            
            result = self.mqtt_client.publish(topic, json.dumps(message), qos=1)
            # if result.rc == mqtt.MQTT_ERR_SUCCESS:
            #     print(f"[MQTTBridge] ✓ Đã gửi toàn bộ {feature_id}: {properties}")
            # else:
            #     print(f"[MQTTBridge] ✗ Gửi thất bại {feature_id}")
            
            time.sleep(0.05)
        
        return True
    
    def disconnect(self):
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
            print(f"[MQTTBridge] Đã ngắt kết nối")
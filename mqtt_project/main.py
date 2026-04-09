# main.py
import time
from simulator import KettleSimulator
from business_logic import BusinessLogic
from mqtt_bridge import MQTTBridge
from config import *

class SmartKettleSystem:
    """Hệ thống hoàn chỉnh - Điều phối 3 module"""
    
    def __init__(self):
        self.simulator = None
        self.business_logic = None
        self.mqtt_bridge = None
        self.running = True
        
    def on_simulator_event(self, event_type: str, data):
        """Callback từ simulator -> gửi sang business logic"""
        if self.business_logic:
            self.business_logic.process_simulator_event(event_type, data)
    
    def on_business_data_ready(self, ditto_data):
        """Callback từ business logic -> dữ liệu đã format, gửi lên MQTT bridge"""
        if self.mqtt_bridge:
            self.mqtt_bridge.send_telemetry(ditto_data)
    
    def on_ditto_command(self, command: str, params):
        """Callback từ MQTT bridge -> nhận lệnh từ Ditto, xử lý qua business logic và gửi xuống simulator"""
        if self.business_logic and self.simulator:
            simulator_command = self.business_logic.process_ditto_command(command, params)
            if simulator_command:
                cmd = simulator_command["command"]
                cmd_params = simulator_command["params"]
                
                print(f"\n[Main] 📤 Thực thi lệnh: {cmd}")
                
                if cmd == "turn_on":
                    self.simulator.turn_on()
                elif cmd == "turn_off":
                    self.simulator.turn_off()
                elif cmd == "set_target_temperature":
                    temp = cmd_params.get("temperature", 100)
                    self.simulator.set_target_temperature(temp)
                elif cmd == "get_status":
                    state = self.simulator.get_state()
                    print(f"\n📊 TRẠNG THÁI HIỆN TẠI:")
                    print(f"   Nhiệt độ: {state['temperature']}°C")
                    print(f"   Trạng thái nguồn: {'BẬT' if state['power_status'] == 'on' else 'TẮT'}")
                    print(f"   Chế độ: {state['heating_status']}")
                    print(f"   Công suất: {state['power_consumption']}W")
    
    def start(self):
        """Khởi động hệ thống"""
        print("\n" + "="*70)
        print("KHỞI ĐỘNG HỆ THỐNG SMART KETTLE")
        print("="*70)
        
        # 1. MQTT bridge
        print("\n[1/3] Khởi tạo MQTT Bridge...")
        self.mqtt_bridge = MQTTBridge(
            broker_host=DITTO_MQTT_BROKER,
            broker_port=DITTO_MQTT_PORT,
            thing_id=THING_ID,
            on_command_received=self.on_ditto_command
        )
        
        # 2. Business logic
        print("[2/3] Khởi tạo Business Logic...")
        self.business_logic = BusinessLogic(
            on_data_to_send=self.on_business_data_ready
        )
        
        # 3. Simulator
        print("[3/3] Khởi tạo Simulator...")
        self.simulator = KettleSimulator(
            on_state_change=self.on_simulator_event
        )
        
        print("\n✅ HỆ THỐNG ĐÃ SẴN SÀNG")
        print("="*70)
        print("\nLuồng dữ liệu nội bộ:")
        print("  Simulator ──callback──> BusinessLogic ──callback──> MQTTBridge")
        print("  MQTTBridge ──callback──> Main ──gọi trực tiếp──> Simulator")
        print("="*70)
        
        # Chạy simulator (blocking - sẽ hiện prompt điều khiển)
        self.simulator.run()
        
        # Dọn dẹp khi kết thúc
        self.stop()
    
    def stop(self):
        """Dừng hệ thống"""
        print("\n[Main] Đang dừng hệ thống...")
        if self.simulator:
            self.simulator.stop()
        if self.mqtt_bridge:
            self.mqtt_bridge.disconnect()
        print("[Main] Hệ thống đã dừng")

if __name__ == "__main__":
    system = SmartKettleSystem()
    system.start()
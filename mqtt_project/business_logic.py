# business_logic.py
from datetime import datetime
from typing import Dict, Any
from neo4j_client import KettleCapability
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, THING_ID

class BusinessLogic:
    """Module 2: Xử lý logic nghiệp vụ"""
    
    def __init__(self, on_data_to_send=None):
        self.on_data_to_send = on_data_to_send
        self.current_state = {}
        
        # Kết nối Neo4j để biết khả năng của ấm
        self.capability = KettleCapability(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
        
        # Lấy và hiển thị khả năng của ấm khi khởi động
        self._show_capabilities()
    
    def _show_capabilities(self):
        """Hiển thị khả năng của ấm từ Knowledge Graph"""
        print("\n" + "="*50)
        print("📋 KHẢ NĂNG CỦA ẤM (từ Knowledge Graph):")
        print("="*50)
        
        # Lấy khả năng cảm biến
        sensing = self.capability.get_sensing_capabilities(THING_ID)
        print("\n📊 Cảm biến:")
        for s in sensing:
            print(f"  - {s['name']}: {s['ditto_path']} ({s['unit']}, {s['range']})")
        
        # Lấy khả năng điều khiển
        control = self.capability.get_control_capabilities(THING_ID)
        print("\n🎮 Điều khiển:")
        for c in control:
            print(f"  - {c['name']}: {c['commands']}")
        print("="*50 + "\n")
        
    def process_simulator_event(self, event_type: str, data: Any):
        """Xử lý sự kiện từ simulator"""
        if event_type == "state_update":
            self.current_state = data
            ditto_data = self.convert_to_ditto_format(data)
            if self.on_data_to_send:
                self.on_data_to_send(ditto_data)
    
    def convert_to_ditto_format(self, simulator_state: Dict[str, Any]) -> Dict[str, Any]:
        """Chuyển đổi sang format Ditto"""
        return {
            "power": {
                "status": simulator_state.get('power_status', 'off'),
                "powerConsumption": simulator_state.get('power_consumption', 0)
            },
            "water": {
                "temperature": simulator_state.get('temperature', 25),
                "waterLevel": simulator_state.get('water_level', 0),
                "targetTemperature": simulator_state.get('target_temperature', 100)
            }
        }
    
    def process_ditto_command(self, command: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Xử lý lệnh từ Ditto - CÓ KIỂM TRA KHẢ NĂNG TỪ NEO4J"""
        
        # Kiểm tra xem ấm có hỗ trợ lệnh này không
        if not self.capability.can_execute_command(THING_ID, command):
            print(f"[BusinessLogic] ❌ Ấm không hỗ trợ lệnh: {command}")
            return None
        
        if command == "turn_on":
            return {"command": "turn_on", "params": {}}
        elif command == "turn_off":
            return {"command": "turn_off", "params": {}}
        elif command == "set_target_temperature":
            temperature = params.get("temperature", 100) if params else 100
            return {"command": "set_target_temperature", "params": {"temperature": temperature}}
        else:
            return None
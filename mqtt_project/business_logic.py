# business_logic.py
from datetime import datetime
from typing import Dict, Any

class BusinessLogic:
    """Module 2: Xử lý logic nghiệp vụ"""
    
    def __init__(self, on_data_to_send=None):
        self.on_data_to_send = on_data_to_send
        self.current_state = {}
        
    def process_simulator_event(self, event_type: str, data: Any):
        """Xử lý sự kiện từ simulator"""
        if event_type == "state_update":
            self.current_state = data
            ditto_data = self.convert_to_ditto_format(data)
            if self.on_data_to_send:
                self.on_data_to_send(ditto_data)
    
    def convert_to_ditto_format(self, simulator_state: Dict[str, Any]) -> Dict[str, Any]:
        """Chuyển đổi sang format Ditto đơn giản"""
        
        # Xác định trạng thái power
        if simulator_state['power_status'] == 'on':
            power_status = 'on'
        else:
            power_status = 'off'
        
        # Trả về format đơn giản: mỗi feature là 1 object chứa properties trực tiếp
        return {
            "power": {
                "status": power_status,
                "powerConsumption": simulator_state.get('power_consumption', 0)
            },
            "water": {
                "temperature": simulator_state.get('temperature', 25),
                "waterLevel": simulator_state.get('water_level', 0),
                # "capacity": 1.7
            }
        }
    
    def process_ditto_command(self, command: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Xử lý lệnh từ Ditto"""
        if command == "turnOn":
            return {"command": "turn_on", "params": {}}
        elif command == "turnOff":
            return {"command": "turn_off", "params": {}}
        elif command == "setTemperature":
            temperature = params.get("temperature", 100) if params else 100
            return {"command": "set_target_temperature", "params": {"temperature": temperature}}
        else:
            return None
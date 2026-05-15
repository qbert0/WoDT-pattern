# simulator.py
import random
import time
import threading
from datetime import datetime
from typing import Dict, Any

class KettleSimulator:
    """Module 1: Giả lập ấm đun nước"""
    
    def __init__(self, on_state_change=None):
        self.on_state_change = on_state_change
        
        # Trạng thái vật lý của ấm
        self.state = {
            "temperature": 25.0,           # Nhiệt độ hiện tại (bắt đầu từ 25 độ)
            "water_level": 50,              # Mực nước (%)
            "power_status": "off",          # on/off
            "heating_status": "idle",       # idle/heating/boiling/keeping_warm
            "power_consumption": 0,         # Công suất (W)
            "target_temperature": 100,      # Nhiệt độ mục tiêu (mặc định 100)
            "total_boils": 0               # Số lần đun sôi
        }
        
        self.running = True
        self.simulator_thread = None
        
    def update_physics(self):
        """Cập nhật trạng thái vật lý dựa trên trạng thái bật/tắt"""
        current_temp = self.state["temperature"]
        
        if self.state["power_status"] == "off":
            # Tắt: nhiệt độ giảm dần về 25 độ
            if current_temp > 25:
                new_temp = max(25, current_temp - 0.3)
                self.state["temperature"] = round(new_temp, 1)
            self.state["heating_status"] = "idle"
            self.state["power_consumption"] = 0
            
        else:  # power_status == "on"
            target = self.state["target_temperature"]
            
            if current_temp < target:
                # Đang đun: nhiệt độ tăng lên
                increase = random.uniform(0.5, 1.2)
                new_temp = min(target, current_temp + increase)
                self.state["temperature"] = round(new_temp, 1)
                
                # Xác định trạng thái đun
                if new_temp >= 99.5:
                    self.state["heating_status"] = "boiling"
                    self.state["power_consumption"] = 1800
                    # Nếu vừa đạt đến sôi
                    if current_temp < 99.5:
                        self.state["total_boils"] += 1
                        print(f"\n[Simulator] 💨 NƯỚC ĐÃ SÔI! Nhiệt độ: {new_temp}°C")
                elif new_temp >= 95:
                    self.state["heating_status"] = "heating"
                    self.state["power_consumption"] = 1500
                else:
                    self.state["heating_status"] = "heating"
                    self.state["power_consumption"] = 1200
                    
            elif current_temp > target:
                # Quá nhiệt độ mục tiêu: giảm nhẹ
                new_temp = max(target, current_temp - 0.2)
                self.state["temperature"] = round(new_temp, 1)
                self.state["power_consumption"] = 300
                self.state["power_status"] = "off"
                self.state["heating_status"] = "idle"
            
        
        return self.state.copy()
    
    def turn_on(self):
        """Bật ấm - bắt đầu đun đến nhiệt độ mục tiêu"""
        if self.state["power_status"] == "off":
            self.state["power_status"] = "on"
            print(f"\n[Simulator] 🔌 Ấm đã được BẬT - Đun đến {self.state['target_temperature']}°C")
            if self.on_state_change:
                self.on_state_change("turn_on", None)
        else:
            print(f"\n[Simulator] ⚠️ Ấm đã ở trạng thái BẬT")
        return self.state.copy()
    
    def turn_off(self):
        """Tắt ấm - ngừng đun, nhiệt độ sẽ giảm dần"""
        if self.state["power_status"] == "on":
            self.state["power_status"] = "off"
            self.state["heating_status"] = "idle"
            print(f"\n[Simulator] 💤 Ấm đã được TẮT - Nhiệt độ sẽ giảm dần")
            if self.on_state_change:
                self.on_state_change("turn_off", None)
        else:
            print(f"\n[Simulator] ⚠️ Ấm đã ở trạng thái TẮT")
        return self.state.copy()
    
    def set_target_temperature(self, temperature: int):
        """Đặt nhiệt độ mục tiêu (chỉ có hiệu lực khi đang bật)"""
        old_target = self.state["target_temperature"]
        temperature = max(70, min(100, temperature))
        self.state["target_temperature"] = temperature
        print(f"\n[Simulator] 🎯 Đặt nhiệt độ mục tiêu: {temperature}°C (cũ: {old_target}°C)")
        if self.on_state_change:
            self.on_state_change("set_target_temperature", {"temperature": temperature})
        return self.state.copy()
    
    def get_state(self) -> Dict[str, Any]:
        """Lấy trạng thái hiện tại"""
        return self.state.copy()
    
    def _simulator_loop(self, update_interval: float = 2.0):
        """Vòng lặp chạy ngầm mô phỏng"""
        while self.running:
            start_time = time.time()
            
            # Cập nhật vật lý
            new_state = self.update_physics()
            
            # Gọi callback để business logic xử lý
            if self.on_state_change:
                self.on_state_change("state_update", new_state)
            
            # Tính thời gian chờ
            elapsed = time.time() - start_time
            sleep_time = max(0, update_interval - elapsed)
            time.sleep(sleep_time)
    
    def _command_loop(self):
        """Vòng lặp nhận lệnh từ terminal"""
        print("\n" + "="*60)
        print("ĐIỀU KHIỂN ẤM ĐUN NƯỚC")
        print("="*60)
        print("Các lệnh có thể dùng:")
        print("  on                    - Bật ấm (đun đến nhiệt độ mục tiêu)")
        print("  off                   - Tắt ấm (ngừng đun, nhiệt độ giảm)")
        print("  temp <70-100>         - Đặt nhiệt độ mục tiêu (VD: temp 95)")
        print("  status                - Xem trạng thái hiện tại")
        print("  quit hoặc Ctrl+C      - Thoát chương trình")
        print("="*60)
        print()
        
        while self.running:
            try:
                command = input("> ").strip().lower()
                
                if command == "on":
                    self.turn_on()
                    
                elif command == "off":
                    self.turn_off()
                    
                elif command.startswith("temp"):
                    parts = command.split()
                    if len(parts) == 2 and parts[1].isdigit():
                        temp = int(parts[1])
                        self.set_target_temperature(temp)
                    else:
                        print("❌ Sai cú pháp. Dùng: temp <70-100>")
                        
                elif command == "status":
                    state = self.get_state()
                    print(f"\n📊 TRẠNG THÁI HIỆN TẠI:")
                    print(f"   Nhiệt độ: {state['temperature']}°C")
                    print(f"   Mực nước: {state['water_level']}%")
                    print(f"   Trạng thái nguồn: {'BẬT' if state['power_status'] == 'on' else 'TẮT'}")
                    print(f"   Chế độ đun: {state['heating_status']}")
                    print(f"   Công suất: {state['power_consumption']}W")
                    print(f"   Nhiệt độ mục tiêu: {state['target_temperature']}°C")
                    print(f"   Số lần đun sôi: {state['total_boils']}")
                    
                elif command == "quit":
                    print("\n[Simulator] Đang dừng...")
                    self.running = False
                    break
                    
                else:
                    print("❌ Lệnh không hợp lệ. Các lệnh: on, off, temp <70-100>, status, quit")
                    
            except EOFError:
                break
            except KeyboardInterrupt:
                print("\n\n[Simulator] Đang dừng...")
                self.running = False
                break
    
    def run(self, update_interval: float = 2.0):
        """Chạy simulator với 2 thread: mô phỏng và nhận lệnh"""
        # Thread mô phỏng
        self.simulator_thread = threading.Thread(target=self._simulator_loop, args=(update_interval,))
        self.simulator_thread.daemon = True
        self.simulator_thread.start()
        
        # Thread nhận lệnh (chạy chính)
        self._command_loop()
        
        # Đợi thread mô phỏng kết thúc
        self.simulator_thread.join(timeout=1)
        
    def stop(self):
        """Dừng simulator"""
        self.running = False
        if self.simulator_thread:
            self.simulator_thread.join(timeout=1)
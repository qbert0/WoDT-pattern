#!/usr/bin/env python3
"""
Smart Home Device Simulator for Eclipse Ditto
Mô phỏng Ấm đun nước, Máy pha cà phê, và Lò nướng
"""

import requests
import json
import time
import random
from datetime import datetime
from threading import Thread

# Cấu hình Ditto
DITTO_URL = "http://100.104.220.45:8080/api/2"
USERNAME = "ditto"
PASSWORD = "ditto"

class SmartDevice:
    """Lớp cơ sở cho các thiết bị thông minh"""
    
    def __init__(self, thing_id, device_name):
        self.thing_id = thing_id
        self.device_name = device_name
        self.running = True
        
    def update_thing(self, updates):
        """Gửi cập nhật lên Ditto"""
        url = f"{DITTO_URL}/things/{self.thing_id}"
        try:
            response = requests.put(
                url,
                auth=(USERNAME, PASSWORD),
                headers={"Content-Type": "application/json"},
                json=updates
            )
            if response.status_code in [200, 204]:
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[{timestamp}] ✓ {self.device_name}: Đã cập nhật dữ liệu")
            else:
                print(f"[ERROR] {self.device_name}: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"[ERROR] {self.device_name}: Không thể kết nối Ditto - {e}")
    
    def update_single_feature(self, feature_id, property_path, value):
        """Cập nhật một thuộc tính cụ thể"""
        url = f"{DITTO_URL}/things/{self.thing_id}/features/{feature_id}/properties/{property_path}"
        try:
            response = requests.put(
                url,
                auth=(USERNAME, PASSWORD),
                headers={"Content-Type": "application/json"},
                json=value
            )
            return response.status_code in [200, 204]
        except Exception as e:
            print(f"[ERROR] {self.device_name}: {e}")
            return False
    
    def stop(self):
        self.running = False


class SmartKettle(SmartDevice):
    """Mô phỏng Ấm đun nước thông minh"""
    
    def __init__(self):
        super().__init__("smart-home:kettle-01", "Ấm đun nước")
        self.water_temperature = 25
        self.water_level = 0
        self.is_boiling = False
        self.power_consumption = 0
        
    def run(self):
        """Vòng lặp chính mô phỏng hoạt động"""
        print(f"[START] {self.device_name} - Bắt đầu mô phỏng")
        
        while self.running:
            # Mô phỏng hành vi ngẫu nhiên
            action = random.choice(['idle', 'add_water', 'boil', 'cool_down'])
            
            if action == 'add_water' and self.water_level < 1.5:
                # Thêm nước vào ấm
                self.water_level = min(1.7, self.water_level + random.uniform(0.3, 0.8))
                self.update_single_feature("water", "currentVolume", round(self.water_level, 2))
                print(f"  🚰 {self.device_name}: Đã thêm {self.water_level:.2f}L nước")
                
            elif action == 'boil' and self.water_level > 0.2 and not self.is_boiling:
                # Bắt đầu đun sôi
                self.is_boiling = True
                self.update_single_feature("power", "status", "on")
                self.update_single_feature("status", "state", "boiling")
                print(f"  🔥 {self.device_name}: BẮT ĐẦU ĐUN SÔI - Nhiệt độ: {self.water_temperature:.1f}°C")
                
                # Mô phỏng quá trình đun
                for temp in range(int(self.water_temperature), 101, 5):
                    if not self.running:
                        break
                    self.water_temperature = temp
                    self.update_single_feature("water", "temperature", self.water_temperature)
                    self.power_consumption = 1800  # 1800W
                    self.update_single_feature("power", "powerConsumption", self.power_consumption)
                    print(f"  🌡️  {self.device_name}: Nhiệt độ {self.water_temperature}°C")
                    time.sleep(1)
                
                # Đun xong
                self.water_temperature = 100
                self.is_boiling = False
                self.update_single_feature("power", "status", "off")
                self.update_single_feature("status", "state", "ready")
                self.update_single_feature("status", "remainingTime", 0)
                self.power_consumption = 0
                self.update_single_feature("power", "powerConsumption", 0)
                print(f"  ✅ {self.device_name}: ĐUN XONG - Nước sôi ở {self.water_temperature}°C")
                
            elif action == 'cool_down' and self.water_temperature > 30:
                # Nguội dần
                self.water_temperature = max(25, self.water_temperature - random.uniform(1, 3))
                self.update_single_feature("water", "temperature", round(self.water_temperature, 1))
                print(f"  ❄️  {self.device_name}: Nguội dần - {self.water_temperature:.1f}°C")
                
            else:
                # Trạng thái idle
                if self.water_temperature > 30:
                    self.water_temperature = max(25, self.water_temperature - 0.5)
                    self.update_single_feature("water", "temperature", round(self.water_temperature, 1))
                    
            time.sleep(random.uniform(3, 8))


class SmartCoffeeMaker(SmartDevice):
    """Mô phỏng Máy pha cà phê"""
    
    def __init__(self):
        super().__init__("smart-home:coffee-maker-01", "Máy pha cà phê")
        self.water_temperature = 25
        self.water_level = 0.5
        self.beans_level = 0.8
        self.is_brewing = False
        
    def run(self):
        print(f"[START] {self.device_name} - Bắt đầu mô phỏng")
        
        while self.running:
            action = random.choice(['idle', 'refill_water', 'refill_beans', 'brew_coffee'])
            
            if action == 'refill_water' and self.water_level < 0.8:
                self.water_level = min(1.0, self.water_level + 0.3)
                self.update_single_feature("brew", "waterLevel", round(self.water_level, 2))
                print(f"  💧 {self.device_name}: Đã thêm nước - Mức nước: {self.water_level*100:.0f}%")
                
            elif action == 'refill_beans' and self.beans_level < 0.5:
                self.beans_level = min(1.0, self.beans_level + 0.4)
                self.update_single_feature("brew", "coffeeBeansLevel", round(self.beans_level, 2))
                print(f"  🫘 {self.device_name}: Đã thêm cà phê - Mức hạt: {self.beans_level*100:.0f}%")
                
            elif action == 'brew_coffee' and self.water_level > 0.3 and self.beans_level > 0.2 and not self.is_brewing:
                self.is_brewing = True
                self.update_single_feature("power", "status", "on")
                self.update_single_feature("status", "state", "brewing")
                self.update_single_feature("status", "currentMode", "brewing")
                print(f"  ☕ {self.device_name}: BẮT ĐẦU PHA CÀ PHÊ")
                
                # Mô phỏng quá trình pha
                for step in range(5):
                    if not self.running:
                        break
                    self.water_temperature = 85 + step * 2
                    self.update_single_feature("brew", "waterTemperature", self.water_temperature)
                    self.update_single_feature("status", "brewTime", (step + 1) * 10)
                    print(f"  ⏳ {self.device_name}: Đang pha... {self.water_temperature}°C - Bước {step+1}/5")
                    time.sleep(1.5)
                
                # Pha xong
                self.water_level -= 0.25
                self.beans_level -= 0.15
                self.is_brewing = False
                self.update_single_feature("brew", "waterLevel", round(self.water_level, 2))
                self.update_single_feature("brew", "coffeeBeansLevel", round(self.beans_level, 2))
                self.update_single_feature("power", "status", "off")
                self.update_single_feature("status", "state", "idle")
                self.update_single_feature("status", "currentMode", "standby")
                
                # Cập nhật thống kê
                self.update_single_feature("statistics", "totalCupsBrewed", 
                                          self.get_current_stats() + 1)
                print(f"  ✅ {self.device_name}: PHA XONG! Thưởng thức cà phê nào!")
                
            time.sleep(random.uniform(4, 10))
    
    def get_current_stats(self):
        """Lấy số cốc đã pha hiện tại"""
        url = f"{DITTO_URL}/things/{self.thing_id}/features/statistics/properties/totalCupsBrewed"
        try:
            response = requests.get(url, auth=(USERNAME, PASSWORD))
            if response.status_code == 200:
                return response.json()
        except:
            pass
        return 0


class SmartOven(SmartDevice):
    """Mô phỏng Lò nướng"""
    
    def __init__(self):
        super().__init__("smart-home:oven-01", "Lò nướng")
        self.temperature = 25
        self.is_cooking = False
        self.door_open = False
        
    def run(self):
        print(f"[START] {self.device_name} - Bắt đầu mô phỏng")
        
        while self.running:
            action = random.choice(['idle', 'preheat', 'cook', 'open_door', 'cool_down'])
            
            if action == 'preheat' and not self.is_cooking and not self.door_open:
                target_temp = random.choice([180, 200, 220, 250])
                self.update_single_feature("cooking", "targetTemperature", target_temp)
                self.update_single_feature("power", "status", "on")
                self.update_single_feature("status", "state", "preheating")
                self.update_single_feature("cooking", "mode", "preheat")
                print(f"  🔥 {self.device_name}: LÀM NÓNG đến {target_temp}°C")
                
                # Mô phỏng làm nóng
                for temp in range(int(self.temperature), target_temp, 15):
                    if not self.running:
                        break
                    self.temperature = temp
                    self.update_single_feature("cooking", "temperature", self.temperature)
                    print(f"  🌡️  {self.device_name}: Nhiệt độ {self.temperature}°C")
                    time.sleep(1)
                
                print(f"  ✅ {self.device_name}: ĐÃ ĐẠT {target_temp}°C - Sẵn sàng nấu!")
                
            elif action == 'cook' and self.temperature > 150 and not self.is_cooking and not self.door_open:
                self.is_cooking = True
                cook_time = random.randint(10, 30)
                self.update_single_feature("cooking", "cookingTime", cook_time)
                self.update_single_feature("cooking", "remainingTime", cook_time)
                self.update_single_feature("status", "state", "cooking")
                print(f"  🍳 {self.device_name}: BẮT ĐẦU NẤU trong {cook_time} phút")
                
                for remaining in range(cook_time, 0, -5):
                    if not self.running:
                        break
                    self.update_single_feature("cooking", "remainingTime", remaining)
                    print(f"  ⏰ {self.device_name}: Còn {remaining} phút")
                    time.sleep(2)
                
                self.is_cooking = False
                self.update_single_feature("status", "state", "cooking_complete")
                self.update_single_feature("cooking", "mode", "keep_warm")
                print(f"  🎉 {self.device_name}: NẤU XONG! Món ăn đã sẵn sàng!")
                
            elif action == 'open_door' and not self.door_open:
                self.door_open = True
                self.update_single_feature("status", "doorOpen", True)
                # Nhiệt độ giảm khi mở cửa
                self.temperature = max(50, self.temperature - 30)
                self.update_single_feature("cooking", "temperature", self.temperature)
                print(f"  🚪 {self.device_name}: MỞ CỬA LÒ - Nhiệt độ giảm còn {self.temperature}°C")
                time.sleep(2)
                self.door_open = False
                self.update_single_feature("status", "doorOpen", False)
                
            elif action == 'cool_down' and self.temperature > 50:
                self.temperature = max(25, self.temperature - random.uniform(5, 15))
                self.update_single_feature("cooking", "temperature", round(self.temperature, 1))
                if self.temperature < 60:
                    self.update_single_feature("power", "status", "off")
                    self.update_single_feature("status", "state", "idle")
                    self.update_single_feature("cooking", "mode", "off")
                    print(f"  💨 {self.device_name}: Đã nguội, tắt lò")
                    
            time.sleep(random.uniform(3, 7))


def main():
    """Hàm chính - Khởi chạy tất cả các thiết bị"""
    print("=" * 60)
    print("🏠 SMART HOME SIMULATOR for Eclipse Ditto")
    print("=" * 60)
    print("Các thiết bị mô phỏng:")
    print("  - Ấm đun nước thông minh")
    print("  - Máy pha cà phê")
    print("  - Lò nướng")
    print("=" * 60)
    print("Nhấn Ctrl+C để dừng chương trình\n")
    
    # Khởi tạo các thiết bị
    kettle = SmartKettle()
    coffee_maker = SmartCoffeeMaker()
    oven = SmartOven()
    
    # Tạo các thread riêng cho từng thiết bị
    threads = []
    
    for device in [kettle, coffee_maker, oven]:
        thread = Thread(target=device.run)
        thread.daemon = True
        thread.start()
        threads.append(thread)
    
    try:
        # Giữ cho chương trình chạy
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n🛑 Đang dừng mô phỏng...")
        kettle.stop()
        coffee_maker.stop()
        oven.stop()
        print("✅ Đã dừng tất cả các thiết bị")
        print("📊 Dữ liệu vẫn được lưu trong Ditto. Bạn có thể kiểm tra lại!")


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Query và hiển thị trạng thái các thiết bị từ Ditto
"""

import requests
import json
from datetime import datetime

DITTO_URL = "http://100.104.220.45:8080/api/2"
USERNAME = "ditto"
PASSWORD = "ditto"

def get_all_things():
    """Lấy tất cả các Thing"""
    url = f"{DITTO_URL}/things"
    response = requests.get(url, auth=(USERNAME, PASSWORD))
    if response.status_code == 200:
        return response.json()
    return {}

def get_thing(thing_id):
    """Lấy thông tin một Thing cụ thể"""
    url = f"{DITTO_URL}/things/{thing_id}"
    response = requests.get(url, auth=(USERNAME, PASSWORD))
    if response.status_code == 200:
        return response.json()
    return None

def display_kettle_status(thing):
    """Hiển thị trạng thái ấm đun nước"""
    print("\n" + "="*50)
    print("🫖 ẤM ĐUN NƯỚC")
    print("="*50)
    
    attrs = thing.get("attributes", {})
    print(f"📍 Vị trí: {attrs.get('location', 'N/A')}")
    print(f"📦 Model: {attrs.get('model', 'N/A')}")
    
    features = thing.get("features", {})
    
    water = features.get("water", {}).get("properties", {})
    print(f"💧 Nhiệt độ nước: {water.get('temperature', 0)}°C")
    print(f"💧 Lượng nước: {water.get('currentVolume', 0)}/{water.get('capacity', 0)}L")
    
    status = features.get("status", {}).get("properties", {})
    print(f"⚙️ Trạng thái: {status.get('state', 'N/A')}")
    
    power = features.get("power", {}).get("properties", {})
    print(f"⚡ Công suất: {power.get('powerConsumption', 0)}W")
    print(f"🔌 Nguồn: {power.get('status', 'N/A')}")

def display_coffee_status(thing):
    """Hiển thị trạng thái máy pha cà phê"""
    print("\n" + "="*50)
    print("☕ MÁY PHA CÀ PHÊ")
    print("="*50)
    
    attrs = thing.get("attributes", {})
    print(f"📍 Vị trí: {attrs.get('location', 'N/A')}")
    print(f"📦 Model: {attrs.get('model', 'N/A')}")
    
    features = thing.get("features", {})
    
    brew = features.get("brew", {}).get("properties", {})
    print(f"💧 Mức nước: {brew.get('waterLevel', 0)*100:.0f}%")
    print(f"🫘 Mức hạt cà phê: {brew.get('coffeeBeansLevel', 0)*100:.0f}%")
    print(f"🌡️ Nhiệt độ nước: {brew.get('waterTemperature', 0)}°C")
    
    status = features.get("status", {}).get("properties", {})
    print(f"⚙️ Trạng thái: {status.get('state', 'N/A')}")
    print(f"🎯 Chế độ: {status.get('currentMode', 'N/A')}")
    
    stats = features.get("statistics", {}).get("properties", {})
    print(f"📊 Tổng số cốc đã pha: {stats.get('totalCupsBrewed', 0)}")

def display_oven_status(thing):
    """Hiển thị trạng thái lò nướng"""
    print("\n" + "="*50)
    print("🔥 LÒ NƯỚNG")
    print("="*50)
    
    attrs = thing.get("attributes", {})
    print(f"📍 Vị trí: {attrs.get('location', 'N/A')}")
    print(f"📦 Model: {attrs.get('model', 'N/A')}")
    
    features = thing.get("features", {})
    
    cooking = features.get("cooking", {}).get("properties", {})
    print(f"🌡️ Nhiệt độ hiện tại: {cooking.get('temperature', 0)}°C")
    print(f"🎯 Nhiệt độ mục tiêu: {cooking.get('targetTemperature', 0)}°C")
    print(f"⏰ Thời gian còn lại: {cooking.get('remainingTime', 0)} phút")
    print(f"🎛️ Chế độ: {cooking.get('mode', 'N/A')}")
    
    status = features.get("status", {}).get("properties", {})
    print(f"⚙️ Trạng thái: {status.get('state', 'N/A')}")
    print(f"🚪 Cửa lò: {'Mở' if status.get('doorOpen') else 'Đóng'}")
    
    power = features.get("power", {}).get("properties", {})
    print(f"🔌 Nguồn: {power.get('status', 'N/A')}")

def main():
    print("🏠 TRẠNG THÁI NHÀ THÔNG MINH")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    things = {
        "smart-home:kettle-01": display_kettle_status,
        "smart-home:coffee-maker-01": display_coffee_status,
        "smart-home:oven-01": display_oven_status
    }
    
    for thing_id, display_func in things.items():
        thing = get_thing(thing_id)
        if thing:
            display_func(thing)
        else:
            print(f"\n❌ Không tìm thấy thiết bị: {thing_id}")
    
    print("\n" + "="*50)
    print("💡 Mẹo: Chạy 'python3 smart_home_simulator.py' để mô phỏng hoạt động!")

if __name__ == "__main__":
    main()
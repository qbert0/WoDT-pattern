import requests
import time
import random
import threading
from datetime import datetime

class SensorAmDunNuoc:
    """Mô phỏng cảm biến của ấm đun nước thực tế"""
    
    def __init__(self, device_id="AM1001", server_url="http://localhost:3001"):
        self.device_id = device_id
        self.server_url = server_url
        
        # Trạng thái vật lý của ấm
        self.nhiet_do_hien_tai = 25.0  # Nhiệt độ phòng
        self.dang_dun = False
        self.nhiet_do_muc_tieu = 100.0
        self.muc_nuoc = 1.5  # Lít
        self.dung_tich_toi_da = 2.0
        self.cong_suat = 2000  # Watt
        
        # Thông số mô phỏng
        self.toc_do_tang_nhiet = 0.5  # °C/giây
        self.toc_do_giam_nhiet = 0.1  # °C/giây
        self.sensor_noise = 0.3  # Nhiễu cảm biến
        
        # Thread gửi dữ liệu
        self.running = False
        self.send_thread = None
        
    def khoi_dong(self):
        """Khởi động gửi dữ liệu liên tục"""
        self.running = True
        self.send_thread = threading.Thread(target=self._gui_du_lieu_lien_tuc, daemon=True)
        self.send_thread.start()
        print(f"✅ Đã khởi động cảm biến {self.device_id}")
        
    def _gui_du_lieu_lien_tuc(self):
        """Gửi dữ liệu cảm biến lên server mỗi giây"""
        while self.running:
            # Cập nhật nhiệt độ dựa trên trạng thái
            self._cap_nhat_nhiet_do()
            
            # Tạo payload dữ liệu
            payload = {
                'device_id': self.device_id,
                'timestamp': datetime.now().isoformat(),
                'nhiet_do': round(self.nhiet_do_hien_tai, 1),
                'dang_dun': self.dang_dun,
                'nhiet_do_muc_tieu': self.nhiet_do_muc_tieu,
                'muc_nuoc': round(self.muc_nuoc, 2),
                'cong_suat': self.cong_suat,
                'trang_thai': 'DANG_DUN' if self.dang_dun else 'TAT'
            }
            
            # Gửi dữ liệu lên server
            try:
                response = requests.post(
                    f"{self.server_url}/api/sensor-data",
                    json=payload,
                    timeout=2
                )
                if response.status_code == 200:
                    # Kiểm tra lệnh điều khiển từ server
                    self._xu_ly_lenh_dieu_khien(response.json())
                    
            except requests.exceptions.RequestException as e:
                print(f"⚠️ Không thể gửi dữ liệu: {e}")
                
            time.sleep(0.5)  # Gửi mỗi giây
            
    def _cap_nhat_nhiet_do(self):
        """Cập nhật nhiệt độ dựa trên trạng thái đun"""
        if self.dang_dun:
            # Đang đun: nhiệt độ tăng
            if self.nhiet_do_hien_tai < self.nhiet_do_muc_tieu:
                delta = self.toc_do_tang_nhiet * (self.cong_suat / 2000)
                self.nhiet_do_hien_tai += delta
                
                # Thêm nhiễu cảm biến
                self.nhiet_do_hien_tai += random.uniform(-self.sensor_noise, self.sensor_noise)
                
                # Giới hạn nhiệt độ
                if self.nhiet_do_hien_tai >= self.nhiet_do_muc_tieu:
                    self.nhiet_do_hien_tai = self.nhiet_do_muc_tieu
                    self.dang_dun = False  # Tự động tắt khi đạt nhiệt độ
                    print(f"🎉 Đã đạt nhiệt độ {self.nhiet_do_muc_tieu}°C, ấm tự động tắt!")
            else:
                self.dang_dun = False
        else:
            # Không đun: nhiệt độ giảm dần về nhiệt độ phòng
            if self.nhiet_do_hien_tai > 25:
                self.nhiet_do_hien_tai -= self.toc_do_giam_nhiet
                self.nhiet_do_hien_tai += random.uniform(-self.sensor_noise/2, self.sensor_noise/2)
                self.nhiet_do_hien_tai = max(self.nhiet_do_hien_tai, 25)
                
    def _xu_ly_lenh_dieu_khien(self, data):
        """Xử lý lệnh điều khiển từ server"""
        if 'command' in data:
            command = data['command']
            
            if command == 'start_heat':
                nhiet_do = data.get('temperature', 100)
                self.bat_dau_dun(nhiet_do)
                
            elif command == 'stop_heat':
                self.dung_dun()
                
            elif command == 'set_target_temp':
                nhiet_do = data.get('temperature', 100)
                self.nhiet_do_muc_tieu = min(max(nhiet_do, 25), 100)
                print(f"🌡️ Đã đặt nhiệt độ mục tiêu: {self.nhiet_do_muc_tieu}°C")
                
    def bat_dau_dun(self, nhiet_do_muc_tieu=None):
        """Bắt đầu đun nước"""
        if self.muc_nuoc <= 0:
            print("❌ Không thể đun vì không có nước!")
            return False
            
        if nhiet_do_muc_tieu:
            self.nhiet_do_muc_tieu = min(max(nhiet_do_muc_tieu, 25), 100)
            
        if self.nhiet_do_hien_tai >= self.nhiet_do_muc_tieu:
            print(f"ℹ️ Nước đã đạt nhiệt độ {self.nhiet_do_muc_tieu}°C")
            return False
            
        self.dang_dun = True
        print(f"🔥 Bắt đầu đun nước đến {self.nhiet_do_muc_tieu}°C")
        return True
        
    def dung_dun(self):
        """Dừng đun nước"""
        if self.dang_dun:
            self.dang_dun = False
            print("⏹️ Đã dừng đun nước")
            return True
        return False
        
    def them_nuoc(self, luong_nuoc):
        """Thêm nước (chỉ mô phỏng, không gửi lệnh từ web)"""
        moi = self.muc_nuoc + luong_nuoc
        if moi > self.dung_tich_toi_da:
            print(f"❌ Không thể thêm {luong_nuoc}L, dung tích tối đa {self.dung_tich_toi_da}L")
            return False
        self.muc_nuoc = moi
        print(f"💧 Đã thêm {luong_nuoc}L nước. Hiện có: {self.muc_nuoc}L")
        return True
        
    def do_nuoc(self, luong_nuoc):
        """Đổ nước (chỉ mô phỏng, không gửi lệnh từ web)"""
        if luong_nuoc > self.muc_nuoc:
            print(f"❌ Không đủ nước để đổ {luong_nuoc}L")
            return False
        self.muc_nuoc -= luong_nuoc
        print(f"🚰 Đã đổ {luong_nuoc}L nước. Còn lại: {self.muc_nuoc}L")
        return True
        
    def dung_lai(self):
        """Dừng simulator"""
        self.running = False
        if self.send_thread:
            self.send_thread.join(timeout=2)
        print("👋 Đã tắt cảm biến")


def chay_simulator():
    """Chạy simulator với giao diện console để thao tác vật lý"""
    sensor = SensorAmDunNuoc()
    sensor.khoi_dong()
    
    print("\n" + "="*60)
    print("🔧 MÁY CẢM BIẾN ẤM ĐUN NƯỚC - THAO TÁC VẬT LÝ")
    print("="*60)
    print("⚠️ LƯU Ý: Các thao tác này mô phỏng hành động ngoài đời thực")
    print("   (đổ nước, thêm nước) và không có trong giao diện web")
    print("="*60)
    
    try:
        while True:
            print("\n📋 THAO TÁC VẬT LÝ:")
            print("1. 💧 Thêm nước vào ấm")
            print("2. 🚰 Đổ nước ra khỏi ấm")
            print("3. 📊 Xem trạng thái hiện tại")
            print("4. ❌ Thoát simulator")
            
            choice = input("\n👉 Chọn thao tác (1-4): ").strip()
            
            if choice == '1':
                try:
                    luong = float(input("Nhập lượng nước cần thêm (Lít): "))
                    sensor.them_nuoc(luong)
                except ValueError:
                    print("❌ Lượng nước không hợp lệ!")
                    
            elif choice == '2':
                try:
                    luong = float(input("Nhập lượng nước cần đổ (Lít): "))
                    sensor.do_nuoc(luong)
                except ValueError:
                    print("❌ Lượng nước không hợp lệ!")
                    
            elif choice == '3':
                print("\n" + "="*40)
                print(f"🆔 Device ID: {sensor.device_id}")
                print(f"🌡️ Nhiệt độ: {sensor.nhiet_do_hien_tai:.1f}°C")
                print(f"🎯 Mục tiêu: {sensor.nhiet_do_muc_tieu}°C")
                print(f"🔥 Đang đun: {'Có' if sensor.dang_dun else 'Không'}")
                print(f"💧 Lượng nước: {sensor.muc_nuoc:.2f}/{sensor.dung_tich_toi_da}L")
                print(f"⚡ Công suất: {sensor.cong_suat}W")
                print("="*40)
                
            elif choice == '4':
                print("Đang tắt simulator...")
                break
                
            else:
                print("❌ Lựa chọn không hợp lệ!")
                
    except KeyboardInterrupt:
        print("\n\n👋 Nhận tín hiệu dừng...")
    finally:
        sensor.dung_lai()


if __name__ == "__main__":
    chay_simulator()
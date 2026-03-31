import requests
import time
import random
import threading
from datetime import datetime
from enum import Enum

class CheDoHoatDong(Enum):
    VI_SONG = "VI_SONG"
    NUONG = "NUONG"
    KET_HOP = "KET_HOP"
    RA_DONG = "RA_DONG"

class TrangThaiCua(Enum):
    DONG = "ĐÓNG"
    MO = "MỞ"

class MicrowaveSensor:
    """Mô phỏng cảm biến của lò vi sóng thực tế"""
    
    def __init__(self, device_id="MW1001", server_url="http://localhost:3002"):
        self.device_id = device_id
        self.server_url = server_url
        
        # === Thông số cảm biến ===
        # Nhiệt độ
        self.nhiet_do_trong = 25.0  # °C
        self.nhiet_do_vo = 25.0  # °C
        
        # Trạng thái
        self.trang_thai_cua = TrangThaiCua.DONG
        self.dang_hoat_dong = False
        self.dang_tam_dung = False
        self.che_do = CheDoHoatDong.VI_SONG
        
        # Thông số hoạt động
        self.cong_suat = 800  # W (0-1000W)
        self.thoi_gian_con_lai = 0  # giây
        self.thoi_gian_dat = 0  # giây
        self.ban_xoay_dang_quay = False
        self.den_sang = False
        self.quat_chay = False
        
        # An toàn
        self.buc_xa_hien_tai = 0.0  # mW/cm²
        self.khoa_an_toan = False
        
        # Thống kê
        self.so_lan_su_dung = 0
        self.tong_thoi_gian_su_dung = 0  # giây
        self.lich_su_hoat_dong = []
        
        # === Thông số mô phỏng vật lý ===
        # Tốc độ tăng nhiệt
        self.toc_do_tang_nhiet = {
            CheDoHoatDong.VI_SONG.value: 0.8,  # °C/giây
            CheDoHoatDong.NUONG.value: 1.2,
            CheDoHoatDong.KET_HOP.value: 1.5,
            CheDoHoatDong.RA_DONG.value: 0.3
        }
        
        self.toc_do_giam_nhiet = 0.1  # °C/giây khi không hoạt động
        self.sensor_noise = 0.3
        
        # Chương trình tự động
        self.auto_programs = {
            'BAP_RANG': {'time': 180, 'power': 100, 'mode': CheDoHoatDong.VI_SONG},
            'PIZZA': {'time': 300, 'power': 80, 'mode': CheDoHoatDong.KET_HOP},
            'KHOAI_TAY': {'time': 360, 'power': 100, 'mode': CheDoHoatDong.VI_SONG},
            'RA_DONG_THIT': {'time': 240, 'power': 50, 'mode': CheDoHoatDong.RA_DONG},
            'SUOI_AM': {'time': 60, 'power': 70, 'mode': CheDoHoatDong.VI_SONG}
        }
        
        # Thread gửi dữ liệu
        self.running = False
        self.send_thread = None
        
    def khoi_dong(self):
        """Khởi động gửi dữ liệu liên tục"""
        self.running = True
        self.send_thread = threading.Thread(target=self._gui_du_lieu_lien_tuc, daemon=True)
        self.send_thread.start()
        print(f"✅ Đã khởi động cảm biến lò vi sóng {self.device_id}")
        
    def _gui_du_lieu_lien_tuc(self):
        """Gửi dữ liệu cảm biến lên server mỗi giây"""
        last_second = 0
        
        while self.running:
            # Cập nhật trạng thái vật lý
            self._cap_nhat_nhiet_do()
            self._cap_nhat_thoi_gian()
            
            # Cập nhật các thành phần phụ
            self._cap_nhat_ban_xoay()
            self._cap_nhat_den()
            self._cap_nhat_quat()
            self._cap_nhat_buc_xa()
            
            # Tạo payload dữ liệu
            payload = {
                'device_id': self.device_id,
                'timestamp': datetime.now().isoformat(),
                
                # Nhiệt độ
                'nhiet_do_trong': round(self.nhiet_do_trong, 1),
                'nhiet_do_vo': round(self.nhiet_do_vo, 1),
                
                # Trạng thái
                'trang_thai_cua': self.trang_thai_cua.value,
                'dang_hoat_dong': self.dang_hoat_dong,
                'dang_tam_dung': self.dang_tam_dung,
                'che_do': self.che_do.value,
                
                # Thông số hoạt động
                'cong_suat': self.cong_suat,
                'thoi_gian_con_lai': self.thoi_gian_con_lai,
                'thoi_gian_dat': self.thoi_gian_dat,
                'ban_xoay_dang_quay': self.ban_xoay_dang_quay,
                'den_sang': self.den_sang,
                'quat_chay': self.quat_chay,
                
                # An toàn
                'buc_xa_hien_tai': round(self.buc_xa_hien_tai, 2),
                'khoa_an_toan': self.khoa_an_toan,
                
                # Thống kê
                'so_lan_su_dung': self.so_lan_su_dung,
                'tong_thoi_gian_su_dung': self.tong_thoi_gian_su_dung
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
                
            time.sleep(1)  # Gửi mỗi giây
    
    def _cap_nhat_nhiet_do(self):
        """Cập nhật nhiệt độ dựa trên trạng thái hoạt động"""
        if self.dang_hoat_dong and not self.dang_tam_dung and self.trang_thai_cua == TrangThaiCua.DONG:
            # Đang hoạt động: tăng nhiệt độ
            toc_do = self.toc_do_tang_nhiet.get(self.che_do.value, 0.5)
            toc_do *= (self.cong_suat / 1000)  # Tỷ lệ với công suất
            
            self.nhiet_do_trong += toc_do
            self.nhiet_do_vo += toc_do * 0.3  # Vỏ nóng chậm hơn
            
            # Thêm nhiễu
            self.nhiet_do_trong += random.uniform(-self.sensor_noise, self.sensor_noise)
            self.nhiet_do_vo += random.uniform(-self.sensor_noise/2, self.sensor_noise/2)
            
            # Giới hạn nhiệt độ an toàn
            self.nhiet_do_trong = min(self.nhiet_do_trong, 250)  # Tối đa 250°C
            self.nhiet_do_vo = min(self.nhiet_do_vo, 80)  # Vỏ tối đa 80°C
            
            # Cảnh báo quá nhiệt
            if self.nhiet_do_trong > 200:
                print("⚠️ CẢNH BÁO: Nhiệt độ bên trong quá cao! (>200°C)")
            if self.nhiet_do_vo > 70:
                print("⚠️ CẢNH BÁO: Vỏ lò quá nóng! (>70°C)")
                
        else:
            # Không hoạt động: nhiệt độ giảm dần
            if self.nhiet_do_trong > 25:
                self.nhiet_do_trong -= self.toc_do_giam_nhiet
                self.nhiet_do_trong = max(self.nhiet_do_trong, 25)
                
            if self.nhiet_do_vo > 25:
                self.nhiet_do_vo -= self.toc_do_giam_nhiet * 0.5
                self.nhiet_do_vo = max(self.nhiet_do_vo, 25)
    
    def _cap_nhat_thoi_gian(self):
        """Cập nhật thời gian còn lại"""
        if self.dang_hoat_dong and not self.dang_tam_dung and self.trang_thai_cua == TrangThaiCua.DONG:
            if self.thoi_gian_con_lai > 0:
                self.thoi_gian_con_lai -= 1
                self.tong_thoi_gian_su_dung += 1
                
                # Kết thúc quá trình
                if self.thoi_gian_con_lai <= 0:
                    self.dung_hoat_dong()
                    print("✅ Hoàn thành! Lò vi sóng đã kết thúc.")
            else:
                self.dung_hoat_dong()
    
    def _cap_nhat_ban_xoay(self):
        """Cập nhật trạng thái bàn xoay"""
        if self.dang_hoat_dong and not self.dang_tam_dung and self.trang_thai_cua == TrangThaiCua.DONG:
            self.ban_xoay_dang_quay = True
        else:
            self.ban_xoay_dang_quay = False
    
    def _cap_nhat_den(self):
        """Cập nhật đèn bên trong"""
        # Đèn sáng khi cửa mở hoặc đang hoạt động
        if self.trang_thai_cua == TrangThaiCua.MO or self.dang_hoat_dong:
            self.den_sang = True
        else:
            self.den_sang = False
    
    def _cap_nhat_quat(self):
        """Cập nhật quạt tản nhiệt"""
        # Quạt chạy khi nhiệt độ cao hoặc đang hoạt động
        if self.dang_hoat_dong or self.nhiet_do_trong > 60 or self.nhiet_do_vo > 50:
            self.quat_chay = True
        else:
            self.quat_chay = False
    
    def _cap_nhat_buc_xa(self):
        """Cập nhật lượng bức xạ (an toàn)"""
        if self.dang_hoat_dong and not self.dang_tam_dung and self.trang_thai_cua == TrangThaiCua.DONG:
            # Bức xạ tỷ lệ với công suất
            self.buc_xa_hien_tai = (self.cong_suat / 1000) * 5.0  # mW/cm²
            self.buc_xa_hien_tai += random.uniform(-0.5, 0.5)
            self.buc_xa_hien_tai = max(0, self.buc_xa_hien_tai)
        else:
            self.buc_xa_hien_tai = 0.0
    
    def _xu_ly_lenh_dieu_khien(self, data):
        """Xử lý lệnh điều khiển từ server"""
        if 'command' in data:
            command = data['command']
            
            if command == 'start':
                self.bat_dau()
                
            elif command == 'pause':
                self.tam_dung()
                
            elif command == 'stop':
                self.dung_hoat_dong()
                
            elif command == 'set_time':
                seconds = data.get('seconds', 0)
                self.dat_thoi_gian(seconds)
                
            elif command == 'set_power':
                power = data.get('power', 80)
                self.dat_cong_suat(power)
                
            elif command == 'set_mode':
                mode = data.get('mode', 'VI_SONG')
                self.chon_che_do(mode)
                
            elif command == 'open_door':
                self.mo_cua()
                
            elif command == 'close_door':
                self.dong_cua()
                
            elif command == 'auto_program':
                program = data.get('program', '')
                self.chay_chuong_trinh_tu_dong(program)
                
            elif command == 'toggle_light':
                self.bat_tat_den()
    
    def bat_dau(self):
        """Bắt đầu hoặc tiếp tục hoạt động"""
        if self.trang_thai_cua == TrangThaiCua.MO:
            print("❌ Không thể bắt đầu khi cửa đang mở!")
            return False
            
        if self.khoa_an_toan:
            print("❌ Khóa an toàn đang bật!")
            return False
            
        if self.thoi_gian_con_lai <= 0:
            print("❌ Chưa đặt thời gian!")
            return False
            
        if not self.dang_hoat_dong:
            self.dang_hoat_dong = True
            self.dang_tam_dung = False
            self.so_lan_su_dung += 1
            print(f"🔥 Bắt đầu lò vi sóng - Chế độ: {self.che_do.value}, Công suất: {self.cong_suat}W")
            return True
        elif self.dang_tam_dung:
            self.dang_tam_dung = False
            print("▶️ Tiếp tục hoạt động")
            return True
        return False
    
    def tam_dung(self):
        """Tạm dừng hoạt động"""
        if self.dang_hoat_dong and not self.dang_tam_dung:
            self.dang_tam_dung = True
            print("⏸️ Tạm dừng")
            return True
        return False
    
    def dung_hoat_dong(self):
        """Dừng hoàn toàn hoạt động"""
        if self.dang_hoat_dong or self.dang_tam_dung:
            self.dang_hoat_dong = False
            self.dang_tam_dung = False
            self.thoi_gian_con_lai = 0
            print("⏹️ Đã dừng hoạt động")
            return True
        return False
    
    def dat_thoi_gian(self, seconds):
        """Đặt thời gian hoạt động"""
        if seconds > 0:
            self.thoi_gian_dat = seconds
            self.thoi_gian_con_lai = seconds
            print(f"⏰ Đã đặt thời gian: {seconds} giây")
            return True
        return False
    
    def dat_cong_suat(self, power_percent):
        """Đặt công suất (0-100%)"""
        if isinstance(power_percent, str):
            try:
                power_percent = float(power_percent)
            except ValueError:
                print(f"❌ Giá trị công suất không hợp lệ: {power_percent}")
                return False
        if 0 <= power_percent <= 100:
            self.cong_suat = int(power_percent * 10)  # 0-1000W
            print(f"⚡ Đã đặt công suất: {power_percent}% ({self.cong_suat}W)")
            return True
        return False
    
    def chon_che_do(self, mode):
        """Chọn chế độ hoạt động"""
        try:
            self.che_do = CheDoHoatDong(mode)
            print(f"🎯 Đã chọn chế độ: {self.che_do.value}")
            return True
        except ValueError:
            print(f"❌ Chế độ không hợp lệ: {mode}")
            return False
    
    def mo_cua(self):
        """Mở cửa lò"""
        if self.dang_hoat_dong:
            print("⚠️ Không thể mở cửa khi đang hoạt động!")
            return False
        
        self.trang_thai_cua = TrangThaiCua.MO
        self.den_sang = True
        print("🚪 Đã mở cửa lò")
        return True
    
    def dong_cua(self):
        """Đóng cửa lò"""
        self.trang_thai_cua = TrangThaiCua.DONG
        print("🚪 Đã đóng cửa lò")
        return True
    
    def chay_chuong_trinh_tu_dong(self, program_name):
        """Chạy chương trình tự động"""
        program = self.auto_programs.get(program_name.upper())
        if program:
            self.dat_thoi_gian(program['time'])
            self.dat_cong_suat(program['power'])
            self.chon_che_do(program['mode'].value)
            print(f"📋 Chạy chương trình: {program_name}")
            return True
        else:
            print(f"❌ Không tìm thấy chương trình: {program_name}")
            return False
    
    def bat_tat_den(self):
        """Bật/tắt đèn (chỉ khi không hoạt động)"""
        if not self.dang_hoat_dong:
            self.den_sang = not self.den_sang
            print(f"💡 Đèn: {'Bật' if self.den_sang else 'Tắt'}")
            return True
        return False
    
    def khoa_an_toan(self, lock):
        """Bật/tắt khóa an toàn"""
        self.khoa_an_toan = lock
        print(f"🔒 Khóa an toàn: {'Bật' if lock else 'Tắt'}")
    
    def hien_thi_trang_thai(self):
        """Hiển thị trạng thái hiện tại"""
        print("\n" + "="*50)
        print(f"🆔 {self.device_id} - LÒ VI SÓNG")
        print("="*50)
        print(f"🌡️ Nhiệt độ trong: {self.nhiet_do_trong:.1f}°C")
        print(f"📦 Nhiệt độ vỏ: {self.nhiet_do_vo:.1f}°C")
        print(f"🚪 Cửa: {self.trang_thai_cua.value}")
        print(f"🎛️ Trạng thái: ", end="")
        if self.dang_hoat_dong:
            print("ĐANG CHẠY" if not self.dang_tam_dung else "TẠM DỪNG")
        else:
            print("TẮT")
        print(f"⚙️ Chế độ: {self.che_do.value}")
        print(f"⚡ Công suất: {self.cong_suat}W ({int(self.cong_suat/10)}%)")
        print(f"⏰ Thời gian còn lại: {self.thoi_gian_con_lai} giây")
        print(f"🔄 Bàn xoay: {'Quay' if self.ban_xoay_dang_quay else 'Dừng'}")
        print(f"💡 Đèn: {'Sáng' if self.den_sang else 'Tắt'}")
        print(f"🌀 Quạt: {'Chạy' if self.quat_chay else 'Dừng'}")
        print(f"📡 Bức xạ: {self.buc_xa_hien_tai:.2f} mW/cm²")
        print(f"🔒 Khóa an toàn: {'Bật' if self.khoa_an_toan else 'Tắt'}")
        print(f"📊 Đã dùng: {self.so_lan_su_dung} lần, {self.tong_thoi_gian_su_dung} giây")
        print("="*50)
    
    def dung_lai(self):
        """Dừng simulator"""
        self.running = False
        if self.send_thread:
            self.send_thread.join(timeout=2)
        print("👋 Đã tắt cảm biến lò vi sóng")


def chay_simulator():
    """Chạy simulator với giao diện console"""
    sensor = MicrowaveSensor()
    sensor.khoi_dong()
    
    print("\n" + "="*60)
    print("🔧 MÁY CẢM BIẾN LÒ VI SÓNG - THAO TÁC VẬT LÝ")
    print("="*60)
    print("⚠️ Các thao tác này mô phỏng hành động ngoài đời thực:")
    print("   - Mở/Đóng cửa lò")
    print("   - Bật/Tắt đèn")
    print("   - Điều chỉnh vật lý khác")
    print("="*60)
    
    try:
        while True:
            print("\n📋 THAO TÁC VẬT LÝ:")
            print("1. 🚪 Mở cửa lò")
            print("2. 🚪 Đóng cửa lò")
            print("3. 💡 Bật/Tắt đèn")
            print("4. 🔒 Bật/Tắt khóa an toàn")
            print("5. 📊 Xem trạng thái chi tiết")
            print("6. ❌ Thoát simulator")
            
            choice = input("\n👉 Chọn thao tác (1-6): ").strip()
            
            if choice == '1':
                sensor.mo_cua()
            elif choice == '2':
                sensor.dong_cua()
            elif choice == '3':
                sensor.bat_tat_den()
            elif choice == '4':
                lock = input("Bật khóa an toàn? (y/n): ").strip().lower()
                sensor.khoa_an_toan(lock == 'y')
            elif choice == '5':
                sensor.hien_thi_trang_thai()
                input("\nNhấn Enter để tiếp tục...")
            elif choice == '6':
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
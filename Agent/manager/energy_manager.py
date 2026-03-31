from flask import Flask, render_template_string, jsonify, request
from flask_cors import CORS
import threading
import time
import requests
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)

# === Cấu trúc dữ liệu ===
class DigitalTwin:
    def __init__(self, name, device_id, ip, port, device_type):
        self.name = name
        self.device_id = device_id
        self.ip = ip
        self.port = port
        self.device_type = device_type
        self.status = "offline"  # offline, idle, running
        self.power_consumption = 0  # W
        self.last_update = None
        self.api_url = f"http://{ip}:{port}"
        
    def to_dict(self):
        return {
            'name': self.name,
            'device_id': self.device_id,
            'ip': self.ip,
            'port': self.port,
            'device_type': self.device_type,
            'status': self.status,
            'power_consumption': self.power_consumption,
            'last_update': self.last_update,
            'api_url': self.api_url
        }

# === Quản lý thiết bị và năng lượng ===
class EnergyManager:
    def __init__(self, total_power=3000):  # Tổng công suất 3000W
        self.devices = {}  # device_id -> DigitalTwin
        self.task_queue = []  # Hàng chờ nhiệm vụ
        self.current_task = None
        self.total_power_limit = total_power
        self.current_power_usage = 0
        self.breakfast_mode = False
        self.lock = threading.Lock()
        
        # Thread giám sát
        self.running = False
        self.monitor_thread = None
        
    def khoi_dong(self):
        """Khởi động hệ thống quản lý"""
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitor_devices, daemon=True)
        self.monitor_thread.start()
        print("✅ Hệ thống quản lý năng lượng đã khởi động")
        
    def _monitor_devices(self):
        """Giám sát trạng thái các thiết bị"""
        while self.running:
            for device_id, device in list(self.devices.items()):
                try:
                    # Kiểm tra kết nối và lấy thông tin
                    response = requests.get(f"{device.api_url}/api/status", timeout=2)
                    if response.status_code == 200:
                        data = response.json()
                        device.status = data.get('status', 'unknown')
                        device.power_consumption = data.get('power_consumption', 0)
                        device.last_update = datetime.now().isoformat()
                    else:
                        device.status = 'offline'
                except:
                    device.status = 'offline'
                    
            time.sleep(3)  # Giám sát mỗi 3 giây
    
    def them_thiet_bi(self, device_info):
        """Thêm thiết bị vào hệ thống"""
        device_id = device_info.get('device_id')
        ip = device_info.get('ip')
        port = device_info.get('port')
        
        # Kiểm tra địa chỉ có hợp lệ không
        try:
            test_url = f"http://{ip}:{port}/api/status"
            response = requests.get(test_url, timeout=3)
            if response.status_code != 200:
                return False, "Không thể kết nối đến thiết bị"
                
            data = response.json()
            device_type = data.get('device_type', 'unknown')
            name = data.get('name', device_id)
            
            # Tạo đối tượng thiết bị
            device = DigitalTwin(name, device_id, ip, port, device_type)
            self.devices[device_id] = device
            return True, f"Đã thêm thiết bị {name} thành công"
            
        except Exception as e:
            return False, f"Địa chỉ không hợp lệ: {str(e)}"
    
    def xoa_thiet_bi(self, device_id):
        """Xóa thiết bị khỏi hệ thống"""
        if device_id in self.devices:
            del self.devices[device_id]
            return True, "Đã xóa thiết bị"
        return False, "Không tìm thấy thiết bị"
    
    def lay_danh_sach_thiet_bi(self):
        """Lấy danh sách thiết bị"""
        return [device.to_dict() for device in self.devices.values()]
    
    def khoi_dong_breakfast(self):
        """Khởi động chế độ làm bữa sáng"""
        with self.lock:
            if not self.devices:
                return False, "Chưa có thiết bị nào trong hệ thống"
            
            # Tạo hàng chờ cho các thiết bị
            self.task_queue = []
            for device_id, device in self.devices.items():
                if device.status == 'idle':
                    task = {
                        'device_id': device_id,
                        'device_name': device.name,
                        'device_type': device.device_type,
                        'priority': 1 if device.device_type == 'AM_DUN_NUOC' else 2,  # Ấm đun nước ưu tiên hơn
                        'estimated_power': 2000 if device.device_type == 'AM_DUN_NUOC' else 1000,
                        'duration': 180 if device.device_type == 'AM_DUN_NUOC' else 300  # 3 phút cho ấm, 5 phút cho lò vi sóng
                    }
                    self.task_queue.append(task)
            
            # Sắp xếp theo độ ưu tiên
            self.task_queue.sort(key=lambda x: x['priority'])
            
            if not self.task_queue:
                return False, "Không có thiết bị nào sẵn sàng"
            
            self.breakfast_mode = True
            self._process_next_task()
            return True, f"Đã khởi động bữa sáng với {len(self.task_queue)} thiết bị"
    
    def _process_next_task(self):
        """Xử lý nhiệm vụ tiếp theo trong hàng chờ"""
        if not self.task_queue:
            self.breakfast_mode = False
            self.current_task = None
            print("✅ Đã hoàn thành tất cả các nhiệm vụ bữa sáng!")
            return
            
        self.current_task = self.task_queue.pop(0)
        device_id = self.current_task['device_id']
        
        # Gửi lệnh khởi động đến thiết bị
        if device_id in self.devices:
            device = self.devices[device_id]
            try:
                if device.device_type == 'AM_DUN_NUOC':
                    # Gửi lệnh đun nước
                    response = requests.post(
                        f"{device.api_url}/api/control",
                        json={'command': 'start_heat', 'temperature': 100},
                        timeout=2
                    )
                else:  # Lò vi sóng
                    response = requests.post(
                        f"{device.api_url}/api/control",
                        json={'command': 'auto_program', 'program': 'SUOI_AM'},
                        timeout=2
                    )
                
                if response.status_code == 200:
                    print(f"🔄 Đang chạy: {self.current_task['device_name']} - "
                          f"Công suất: {self.current_task['estimated_power']}W")
                    
                    # Lên lịch kiểm tra hoàn thành
                    threading.Timer(self.current_task['duration'], self._check_task_completion, 
                                  args=[device_id]).start()
                else:
                    print(f"❌ Lỗi khi khởi động {self.current_task['device_name']}")
                    self._process_next_task()  # Chuyển sang task tiếp theo
                    
            except Exception as e:
                print(f"❌ Lỗi kết nối: {e}")
                self._process_next_task()
    
    def _check_task_completion(self, device_id):
        """Kiểm tra nhiệm vụ đã hoàn thành chưa"""
        with self.lock:
            try:
                device = self.devices.get(device_id)
                if device:
                    # Gửi lệnh dừng
                    if device.device_type == 'AM_DUN_NUOC':
                        requests.post(f"{device.api_url}/api/control", 
                                    json={'command': 'stop_heat'}, timeout=2)
                    else:
                        requests.post(f"{device.api_url}/api/control", 
                                    json={'command': 'stop'}, timeout=2)
                    
                    print(f"✅ Hoàn thành: {self.current_task['device_name']}")
                    
            except Exception as e:
                print(f"⚠️ Lỗi khi dừng thiết bị: {e}")
            
            # Xử lý nhiệm vụ tiếp theo
            self._process_next_task()
    
    def lay_thong_tin_nang_luong(self):
        """Lấy thông tin về năng lượng hiện tại"""
        with self.lock:
            total_power = sum(d.power_consumption for d in self.devices.values())
            return {
                'total_power_limit': self.total_power_limit,
                'current_power_usage': total_power,
                'remaining_power': self.total_power_limit - total_power,
                'breakfast_mode': self.breakfast_mode,
                'current_task': self.current_task,
                'queue_length': len(self.task_queue),
                'devices_count': len(self.devices)
            }
    
    def dung_lai(self):
        """Dừng hệ thống"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=2)

# Khởi tạo manager
manager = EnergyManager()
manager.khoi_dong()

# === HTML Template ===
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Energy Manager - Smart Home</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .energy-stats {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            color: white;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        
        .stat-card {
            text-align: center;
            background: rgba(255,255,255,0.2);
            padding: 15px;
            border-radius: 10px;
        }
        
        .stat-value {
            font-size: 2em;
            font-weight: bold;
        }
        
        .stat-label {
            font-size: 0.9em;
            margin-top: 5px;
            opacity: 0.9;
        }
        
        .add-device-section, .devices-section, .breakfast-section {
            background: white;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        
        .section-title {
            font-size: 1.5em;
            color: #667eea;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
            padding-left: 10px;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: #666;
            font-weight: 500;
        }
        
        input, select {
            width: 100%;
            padding: 10px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 1em;
            transition: border-color 0.3s;
        }
        
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        button {
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1em;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .btn-breakfast {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            font-size: 1.2em;
            padding: 15px;
            width: 100%;
        }
        
        .btn-danger {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
        }
        
        .device-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        
        .device-card {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 15px;
            border-left: 4px solid #667eea;
            transition: transform 0.2s;
        }
        
        .device-card:hover {
            transform: translateX(5px);
        }
        
        .device-name {
            font-size: 1.2em;
            font-weight: bold;
            color: #333;
        }
        
        .device-id {
            font-family: monospace;
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }
        
        .device-status {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            margin-top: 10px;
        }
        
        .status-online {
            background: #51cf66;
            color: white;
        }
        
        .status-offline {
            background: #ff6b6b;
            color: white;
        }
        
        .status-running {
            background: #ffd93d;
            color: #333;
            animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .device-power {
            margin-top: 10px;
            font-size: 0.9em;
            color: #ff6b6b;
            font-weight: bold;
        }
        
        .queue-item {
            background: #e7f3ff;
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
        }
        
        .current-task {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
        }
        
        .alert {
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
        }
        
        .alert-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .alert-error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        .timestamp {
            text-align: center;
            color: white;
            margin-top: 20px;
            font-size: 0.9em;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ Smart Energy Manager</h1>
            <p>Quản lý thông minh nguồn điện cho các thiết bị Digital Twin</p>
        </div>
        
        <!-- Thống kê năng lượng -->
        <div class="energy-stats" id="energyStats">
            <div class="stat-card">
                <div class="stat-value" id="totalPower">0</div>
                <div class="stat-label">Tổng công suất (W)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="currentUsage">0</div>
                <div class="stat-label">Đang sử dụng (W)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="remainingPower">0</div>
                <div class="stat-label">Còn lại (W)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="devicesCount">0</div>
                <div class="stat-label">Thiết bị</div>
            </div>
        </div>
        
        <!-- Thêm thiết bị -->
        <div class="add-device-section">
            <div class="section-title">🔌 Thêm Digital Twin mới</div>
            <div class="form-group">
                <label>Địa chỉ IP và Port:</label>
                <input type="text" id="deviceAddress" placeholder="Ví dụ: 192.168.1.100:3001 hoặc localhost:3001">
                <small style="color: #666;">Định dạng: IP:PORT (VD: localhost:3001)</small>
            </div>
            <button onclick="addDevice()">➕ Thêm thiết bị</button>
            <div id="addMessage" style="margin-top: 10px;"></div>
        </div>
        
        <!-- Danh sách thiết bị -->
        <div class="devices-section">
            <div class="section-title">📱 Các Digital Twin đã kết nối</div>
            <div id="devicesList" class="device-grid">
                <p style="color: #999;">Chưa có thiết bị nào. Hãy thêm thiết bị ở trên!</p>
            </div>
        </div>
        
        <!-- Điều khiển bữa sáng -->
        <div class="breakfast-section">
            <div class="section-title">🍳 Chế độ bữa sáng</div>
            <button class="btn-breakfast" onclick="startBreakfast()" id="breakfastBtn">
                🍳 LÀM BỮA SÁNG
            </button>
            <div id="breakfastStatus"></div>
            
            <!-- Hàng chờ nhiệm vụ -->
            <div id="queueInfo" style="margin-top: 20px;"></div>
            <div id="currentTaskInfo"></div>
        </div>
        
        <div class="timestamp">
            Last update: <span id="lastUpdate">--</span>
        </div>
    </div>
    
    <script>
        // Cập nhật dữ liệu mỗi 2 giây
        function fetchData() {
            fetch('/api/devices')
                .then(response => response.json())
                .then(data => {
                    // Cập nhật danh sách thiết bị
                    const devicesList = document.getElementById('devicesList');
                    if (data.devices.length === 0) {
                        devicesList.innerHTML = '<p style="color: #999;">Chưa có thiết bị nào. Hãy thêm thiết bị ở trên!</p>';
                    } else {
                        devicesList.innerHTML = data.devices.map(device => `
                            <div class="device-card">
                                <div class="device-name">${device.name}</div>
                                <div class="device-id">ID: ${device.device_id}</div>
                                <div class="device-id">📍 ${device.ip}:${device.port}</div>
                                <div>
                                    <span class="device-status status-${device.status}">
                                        ${device.status === 'running' ? '🟢 ĐANG CHẠY' : 
                                          device.status === 'idle' ? '⚪ SẴN SÀNG' : 
                                          device.status === 'offline' ? '⚫ OFFLINE' : '🔵 ' + device.status}
                                    </span>
                                </div>
                                <div class="device-power">⚡ Công suất: ${device.power_consumption}W</div>
                                <button onclick="removeDevice('${device.device_id}')" style="margin-top: 10px; background: #dc3545; padding: 5px 10px; font-size: 0.9em;">
                                    🗑️ Xóa
                                </button>
                            </div>
                        `).join('');
                    }
                    
                    document.getElementById('devicesCount').textContent = data.devices.length;
                    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
                })
                .catch(error => console.error('Lỗi:', error));
                
            // Cập nhật thông tin năng lượng
            fetch('/api/energy-info')
                .then(response => response.json())
                .then(data => {
                    document.getElementById('totalPower').textContent = data.total_power_limit;
                    document.getElementById('currentUsage').textContent = data.current_power_usage;
                    document.getElementById('remainingPower').textContent = data.remaining_power;
                    
                    // Cập nhật thông tin bữa sáng
                    const breakfastBtn = document.getElementById('breakfastBtn');
                    if (data.breakfast_mode) {
                        breakfastBtn.disabled = true;
                        breakfastBtn.textContent = '🍳 ĐANG CHẾ BIẾN BỮA SÁNG...';
                    } else {
                        breakfastBtn.disabled = false;
                        breakfastBtn.textContent = '🍳 LÀM BỮA SÁNG';
                    }
                    
                    // Hiển thị hàng chờ
                    if (data.queue_length > 0) {
                        document.getElementById('queueInfo').innerHTML = `
                            <div class="alert alert-success">
                                📋 Hàng chờ: ${data.queue_length} nhiệm vụ đang chờ xử lý
                            </div>
                        `;
                    } else {
                        document.getElementById('queueInfo').innerHTML = '';
                    }
                    
                    // Hiển thị nhiệm vụ hiện tại
                    if (data.current_task) {
                        document.getElementById('currentTaskInfo').innerHTML = `
                            <div class="current-task">
                                <strong>🔄 Đang thực hiện:</strong><br>
                                📱 ${data.current_task.device_name}<br>
                                ⚡ Công suất: ${data.current_task.estimated_power}W<br>
                                ⏱️ Thời gian dự kiến: ${data.current_task.duration}s
                            </div>
                        `;
                    } else {
                        document.getElementById('currentTaskInfo').innerHTML = '';
                    }
                })
                .catch(error => console.error('Lỗi:', error));
        }
        
        // Thêm thiết bị
        function addDevice() {
            const address = document.getElementById('deviceAddress').value.trim();
            if (!address) {
                showMessage('Vui lòng nhập địa chỉ!', 'error');
                return;
            }
            
            // Parse địa chỉ
            let ip, port;
            if (address.includes(':')) {
                [ip, port] = address.split(':');
            } else {
                showMessage('Định dạng không hợp lệ. Vui lòng nhập IP:PORT', 'error');
                return;
            }
            
            fetch('/api/add-device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: ip, port: parseInt(port) })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage(data.message, 'success');
                    document.getElementById('deviceAddress').value = '';
                    fetchData();
                } else {
                    showMessage(data.message, 'error');
                }
            })
            .catch(error => {
                showMessage('Lỗi kết nối: ' + error, 'error');
            });
        }
        
        // Xóa thiết bị
        function removeDevice(deviceId) {
            if (confirm('Bạn có chắc muốn xóa thiết bị này?')) {
                fetch('/api/remove-device', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_id: deviceId })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showMessage(data.message, 'success');
                        fetchData();
                    } else {
                        showMessage(data.message, 'error');
                    }
                });
            }
        }
        
        // Khởi động bữa sáng
        function startBreakfast() {
            fetch('/api/start-breakfast', {
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage(data.message, 'success');
                    fetchData();
                } else {
                    showMessage(data.message, 'error');
                }
            });
        }
        
        // Hiển thị thông báo
        function showMessage(message, type) {
            const msgDiv = document.getElementById('addMessage');
            msgDiv.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
            setTimeout(() => {
                msgDiv.innerHTML = '';
            }, 3000);
        }
        
        // Cập nhật mỗi 2 giây
        setInterval(fetchData, 2000);
        fetchData();
    </script>
</body>
</html>
'''

# === API Routes ===
@app.route('/')
def index():
    """Trang chủ"""
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/devices')
def get_devices():
    """Lấy danh sách thiết bị"""
    devices = manager.lay_danh_sach_thiet_bi()
    return jsonify({'devices': devices})

@app.route('/api/add-device', methods=['POST'])
def add_device():
    """Thêm thiết bị mới"""
    data = request.json
    ip = data.get('ip')
    port = data.get('port')
    
    # Tạo device_id tự động
    device_id = f"DT_{ip.replace('.', '_')}_{port}"
    device_info = {
        'device_id': device_id,
        'ip': ip,
        'port': port
    }
    
    success, message = manager.them_thiet_bi(device_info)
    return jsonify({'success': success, 'message': message})

@app.route('/api/remove-device', methods=['POST'])
def remove_device():
    """Xóa thiết bị"""
    data = request.json
    device_id = data.get('device_id')
    success, message = manager.xoa_thiet_bi(device_id)
    return jsonify({'success': success, 'message': message})

@app.route('/api/start-breakfast', methods=['POST'])
def start_breakfast():
    """Khởi động chế độ bữa sáng"""
    success, message = manager.khoi_dong_breakfast()
    return jsonify({'success': success, 'message': message})

@app.route('/api/energy-info')
def energy_info():
    """Lấy thông tin năng lượng"""
    info = manager.lay_thong_tin_nang_luong()
    return jsonify(info)

if __name__ == '__main__':
    print("="*60)
    print("⚡ SMART ENERGY MANAGER - QUẢN LÝ NĂNG LƯỢNG THÔNG MINH")
    print("="*60)
    print("📍 Server quản lý đang chạy tại: http://localhost:3000")
    print("📡 Đang chờ kết nối từ các Digital Twin...")
    print("="*60)
    print("Các bước thực hiện:")
    print("1. Chạy ấm đun nước (port 3001) và lò vi sóng (port 3002)")
    print("2. Thêm địa chỉ của các thiết bị vào đây")
    print("3. Nhấn 'Làm bữa sáng' để bắt đầu quy trình")
    print("="*60)
    
    app.run(host='0.0.0.0', port=3000, debug=True, use_reloader=False)
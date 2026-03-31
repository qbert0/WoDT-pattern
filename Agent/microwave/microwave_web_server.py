from flask import Flask, render_template_string, jsonify, request
from flask_cors import CORS
import threading
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Lưu trữ dữ liệu từ cảm biến
sensor_data = {
    'device_id': 'MW1001',
    'last_update': None,
    
    # Nhiệt độ
    'nhiet_do_trong': 25.0,
    'nhiet_do_vo': 25.0,
    
    # Trạng thái
    'trang_thai_cua': 'ĐÓNG',
    'dang_hoat_dong': False,
    'dang_tam_dung': False,
    'che_do': 'VI_SONG',
    
    # Thông số hoạt động
    'cong_suat': 800,
    'thoi_gian_con_lai': 0,
    'thoi_gian_dat': 0,
    'ban_xoay_dang_quay': False,
    'den_sang': False,
    'quat_chay': False,
    
    # An toàn
    'buc_xa_hien_tai': 0.0,
    'khoa_an_toan': False,
    
    # Thống kê
    'so_lan_su_dung': 0,
    'tong_thoi_gian_su_dung': 0,
    
    # Lịch sử
    'history': []
}

# Queue lệnh điều khiển
command_queue = []

# HTML Template với giao diện hiện đại
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Twin - Lò Vi Sóng Thông Minh</title>
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
        
        .device-id {
            background: rgba(255,255,255,0.2);
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            margin-top: 10px;
            font-family: monospace;
        }
        
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: white;
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: transform 0.3s;
        }
        
        .card:hover {
            transform: translateY(-5px);
        }
        
        .card h3 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.3em;
            border-left: 4px solid #667eea;
            padding-left: 10px;
        }
        
        .temp-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 15px 0;
        }
        
        .temp-item {
            text-align: center;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        
        .temp-label {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 5px;
        }
        
        .temp-value {
            font-size: 2em;
            font-weight: bold;
            color: #ff6b6b;
        }
        
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            text-align: center;
            margin: 10px 0;
        }
        
        .status-running {
            background: #ff6b6b;
            color: white;
            animation: pulse 1s infinite;
        }
        
        .status-paused {
            background: #ffd93d;
            color: #333;
        }
        
        .status-idle {
            background: #51cf66;
            color: white;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .info-label {
            font-weight: 600;
            color: #555;
        }
        
        .info-value {
            color: #333;
        }
        
        .control-group {
            margin: 15px 0;
        }
        
        .control-group label {
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
        
        input:focus, select:focus {
            outline: none;
            border-color: #667eea;
        }
        
        button {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1em;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            margin-top: 8px;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .btn-danger {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        
        .btn-success {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        
        .program-buttons {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        
        .program-btn {
            background: #f0f0f0;
            color: #333;
            font-size: 0.9em;
            padding: 8px;
        }
        
        .program-btn:hover {
            background: #667eea;
            color: white;
        }
        
        .history {
            max-height: 300px;
            overflow-y: auto;
        }
        
        .history-item {
            padding: 10px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .history-time {
            color: #999;
            font-size: 0.85em;
        }
        
        .history-temp {
            font-weight: bold;
            color: #ff6b6b;
        }
        
        .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px;
            margin-top: 10px;
            border-radius: 5px;
        }
        
        .safety-warning {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
            color: #721c24;
        }
        
        .timestamp {
            text-align: center;
            color: white;
            margin-top: 20px;
            font-size: 0.9em;
            opacity: 0.8;
        }
        
        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔬 Digital Twin - Lò Vi Sóng Thông Minh</h1>
            <p>Mô phỏng thời gian thực với đầy đủ cảm biến</p>
            <div class="device-id" id="deviceId">Đang kết nối...</div>
        </div>
        
        <div class="dashboard">
            <!-- Card Nhiệt độ & Trạng thái -->
            <div class="card">
                <h3>🌡️ Nhiệt độ & Trạng thái</h3>
                <div class="temp-grid">
                    <div class="temp-item">
                        <div class="temp-label">Bên trong</div>
                        <div class="temp-value"><span id="tempTrong">--</span>°C</div>
                    </div>
                    <div class="temp-item">
                        <div class="temp-label">Vỏ ngoài</div>
                        <div class="temp-value"><span id="tempVo">--</span>°C</div>
                    </div>
                </div>
                <div id="statusDisplay" class="status-badge status-idle">TẮT</div>
                <div class="info-row">
                    <span class="info-label">🚪 Cửa lò:</span>
                    <span class="info-value" id="doorStatus">--</span>
                </div>
                <div class="info-row">
                    <span class="info-label">⚙️ Chế độ:</span>
                    <span class="info-value" id="mode">--</span>
                </div>
                <div class="info-row">
                    <span class="info-label">⚡ Công suất:</span>
                    <span class="info-value"><span id="power">--</span>W (<span id="powerPercent">--</span>%)</span>
                </div>
                <div class="info-row">
                    <span class="info-label">⏰ Thời gian còn lại:</span>
                    <span class="info-value" id="timeRemaining">--</span>
                </div>
                <div class="info-row">
                    <span class="info-label">🔄 Bàn xoay:</span>
                    <span class="info-value" id="turntable">--</span>
                </div>
                <div class="info-row">
                    <span class="info-label">💡 Đèn:</span>
                    <span class="info-value" id="light">--</span>
                </div>
                <div class="info-row">
                    <span class="info-label">🌀 Quạt:</span>
                    <span class="info-value" id="fan">--</span>
                </div>
                <div id="radiationWarning" style="display: none;" class="warning safety-warning">
                    ⚠️ CẢNH BÁO: Bức xạ vi sóng!
                </div>
            </div>
            
            <!-- Card Điều khiển -->
            <div class="card">
                <h3>🎮 Điều khiển từ xa</h3>
                <div class="control-group">
                    <label>⏱️ Thời gian (giây):</label>
                    <input type="number" id="timeInput" min="1" max="3600" value="60">
                </div>
                <div class="control-group">
                    <label>⚡ Công suất (0-100%):</label>
                    <input type="range" id="powerSlider" min="0" max="100" value="80">
                    <span id="powerValue">80%</span>
                </div>
                <div class="control-group">
                    <label>🎯 Chế độ:</label>
                    <select id="modeSelect">
                        <option value="VI_SONG">Vi sóng</option>
                        <option value="NUONG">Nướng</option>
                        <option value="KET_HOP">Kết hợp</option>
                        <option value="RA_DONG">Rã đông</option>
                    </select>
                </div>
                <button onclick="setTime()">⏰ Đặt thời gian</button>
                <button onclick="setPower()">⚡ Đặt công suất</button>
                <button onclick="setMode()">🎯 Đặt chế độ</button>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                    <button onclick="startMicrowave()" class="btn-success">▶️ BẮT ĐẦU</button>
                    <button onclick="pauseMicrowave()">⏸️ TẠM DỪNG</button>
                    <button onclick="stopMicrowave()" class="btn-danger">⏹️ DỪNG</button>
                    <button onclick="openDoor()">🚪 MỞ CỬA</button>
                </div>
            </div>
            
            <!-- Card Chương trình tự động -->
            <div class="card">
                <h3>📋 Chương trình tự động</h3>
                <div class="program-buttons">
                    <button class="program-btn" onclick="runProgram('BAP_RANG')">🍿 Bắp rang</button>
                    <button class="program-btn" onclick="runProgram('PIZZA')">🍕 Pizza</button>
                    <button class="program-btn" onclick="runProgram('KHOAI_TAY')">🥔 Khoai tây</button>
                    <button class="program-btn" onclick="runProgram('RA_DONG_THIT')">🥩 Rã đông thịt</button>
                    <button class="program-btn" onclick="runProgram('SUOI_AM')">🔥 Sưởi ấm</button>
                </div>
                
                <div class="info-row" style="margin-top: 15px;">
                    <span class="info-label">📊 Số lần sử dụng:</span>
                    <span class="info-value" id="usageCount">--</span>
                </div>
                <div class="info-row">
                    <span class="info-label">⏱️ Tổng thời gian:</span>
                    <span class="info-value" id="totalTime">--</span>
                </div>
                <div class="info-row">
                    <span class="info-label">🔒 Khóa an toàn:</span>
                    <span class="info-value" id="safetyLock">--</span>
                </div>
                
                <div class="warning">
                    <p>⚠️ <strong>Lưu ý an toàn:</strong></p>
                    <p>• Không mở cửa khi đang hoạt động</p>
                    <p>• Không cho kim loại vào lò</p>
                    <p>• Bức xạ chỉ phát khi cửa đóng</p>
                </div>
            </div>
        </div>
        
        <!-- Card Lịch sử -->
        <div class="card">
            <h3>📊 Lịch sử hoạt động</h3>
            <div class="history" id="historyList">
                <div class="history-item">Đang cập nhật...</div>
            </div>
        </div>
        
        <div class="timestamp">
            Last update: <span id="lastUpdate">--</span>
        </div>
    </div>
    
    <script>
        let currentPower = 80;
        
        // Cập nhật dữ liệu mỗi 2 giây
        function fetchData() {
            fetch('/api/sensor-data')
                .then(response => response.json())
                .then(data => {
                    // Cập nhật nhiệt độ
                    document.getElementById('tempTrong').textContent = data.nhiet_do_trong;
                    document.getElementById('tempVo').textContent = data.nhiet_do_vo;
                    document.getElementById('deviceId').textContent = data.device_id;
                    
                    // Cập nhật trạng thái
                    const statusDiv = document.getElementById('statusDisplay');
                    if (data.dang_hoat_dong && !data.dang_tam_dung) {
                        statusDiv.textContent = '🔥 ĐANG HOẠT ĐỘNG';
                        statusDiv.className = 'status-badge status-running';
                    } else if (data.dang_tam_dung) {
                        statusDiv.textContent = '⏸️ TẠM DỪNG';
                        statusDiv.className = 'status-badge status-paused';
                    } else {
                        statusDiv.textContent = '💤 TẮT / CHỜ';
                        statusDiv.className = 'status-badge status-idle';
                    }
                    
                    document.getElementById('doorStatus').textContent = data.trang_thai_cua;
                    document.getElementById('mode').textContent = data.che_do;
                    document.getElementById('power').textContent = data.cong_suat;
                    document.getElementById('powerPercent').textContent = Math.round(data.cong_suat / 10);
                    document.getElementById('timeRemaining').textContent = data.thoi_gian_con_lai + 's';
                    document.getElementById('turntable').textContent = data.ban_xoay_dang_quay ? 'Đang quay 🔄' : 'Dừng';
                    document.getElementById('light').textContent = data.den_sang ? 'Sáng 💡' : 'Tắt';
                    document.getElementById('fan').textContent = data.quat_chay ? 'Đang chạy 🌀' : 'Dừng';
                    document.getElementById('usageCount').textContent = data.so_lan_su_dung;
                    document.getElementById('totalTime').textContent = Math.floor(data.tong_thoi_gian_su_dung / 60) + ' phút';
                    document.getElementById('safetyLock').textContent = data.khoa_an_toan ? 'Bật 🔒' : 'Tắt';
                    
                    // Cảnh báo bức xạ
                    const radiationWarning = document.getElementById('radiationWarning');
                    if (data.buc_xa_hien_tai > 1.0) {
                        radiationWarning.style.display = 'block';
                        radiationWarning.innerHTML = `⚠️ CẢNH BÁO: Bức xạ vi sóng! (${data.buc_xa_hien_tai} mW/cm²)`;
                    } else {
                        radiationWarning.style.display = 'none';
                    }
                    
                    // Cập nhật lịch sử
                    if (data.history && data.history.length > 0) {
                        const historyHtml = data.history.slice().reverse().map(item => {
                            const time = new Date(item.time).toLocaleTimeString();
                            return `
                                <div class="history-item">
                                    <span class="history-time">${time}</span>
                                    <span class="history-temp">${item.temp}°C</span>
                                    <span>${item.status}</span>
                                </div>
                            `;
                        }).join('');
                        document.getElementById('historyList').innerHTML = historyHtml;
                    }
                    
                    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
                })
                .catch(error => {
                    console.error('Lỗi:', error);
                });
        }
        
        // Điều khiển công suất slider
        document.getElementById('powerSlider').addEventListener('input', function(e) {
            currentPower = e.target.value;
            document.getElementById('powerValue').textContent = currentPower + '%';
        });
        
        // Gửi lệnh điều khiển
        function sendCommand(command, params = {}) {
            const data = { command: command, ...params };
            
            fetch('/api/control', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Lệnh đã gửi:', data.message);
                    setTimeout(fetchData, 500);
                } else {
                    alert('Lỗi: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Lỗi:', error);
                alert('Không thể gửi lệnh đến thiết bị');
            });
        }
        
        function setTime() {
            const seconds = parseInt(document.getElementById('timeInput').value);
            sendCommand('set_time', { seconds: seconds });
        }
        
        function setPower() {
            sendCommand('set_power', { power: currentPower });
        }
        
        function setMode() {
            const mode = document.getElementById('modeSelect').value;
            sendCommand('set_mode', { mode: mode });
        }
        
        function startMicrowave() {
            sendCommand('start');
        }
        
        function pauseMicrowave() {
            sendCommand('pause');
        }
        
        function stopMicrowave() {
            sendCommand('stop');
        }
        
        function openDoor() {
            sendCommand('open_door');
        }
        
        function runProgram(program) {
            sendCommand('auto_program', { program: program });
        }
        
        // Cập nhật mỗi 2 giây
        setInterval(fetchData, 2000);
        fetchData();
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    """Trang chủ hiển thị giao diện digital twin"""
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/sensor-data', methods=['GET', 'POST'])
def sensor_data_handler():
    """Nhận dữ liệu từ cảm biến và trả về dữ liệu hiện tại"""
    global sensor_data, command_queue
    
    if request.method == 'POST':
        # Nhận dữ liệu từ cảm biến
        data = request.json
        sensor_data.update(data)
        sensor_data['last_update'] = datetime.now().isoformat()
        
        # Thêm vào lịch sử
        sensor_data['history'].append({
            'time': datetime.now().isoformat(),
            'temp': sensor_data['nhiet_do_trong'],
            'status': 'Đang chạy' if sensor_data['dang_hoat_dong'] else 'Tắt'
        })
        
        # Giữ 50 bản ghi gần nhất
        if len(sensor_data['history']) > 50:
            sensor_data['history'] = sensor_data['history'][-50:]
        
        # Trả về lệnh điều khiển nếu có
        if command_queue:
            return jsonify(command_queue.pop(0))
        return jsonify({'status': 'ok'})
    
    else:  # GET
        # Trả về dữ liệu hiện tại cho web
        return jsonify({
            'device_id': sensor_data['device_id'],
            'nhiet_do_trong': sensor_data['nhiet_do_trong'],
            'nhiet_do_vo': sensor_data['nhiet_do_vo'],
            'trang_thai_cua': sensor_data['trang_thai_cua'],
            'dang_hoat_dong': sensor_data['dang_hoat_dong'],
            'dang_tam_dung': sensor_data['dang_tam_dung'],
            'che_do': sensor_data['che_do'],
            'cong_suat': sensor_data['cong_suat'],
            'thoi_gian_con_lai': sensor_data['thoi_gian_con_lai'],
            'thoi_gian_dat': sensor_data['thoi_gian_dat'],
            'ban_xoay_dang_quay': sensor_data['ban_xoay_dang_quay'],
            'den_sang': sensor_data['den_sang'],
            'quat_chay': sensor_data['quat_chay'],
            'buc_xa_hien_tai': sensor_data['buc_xa_hien_tai'],
            'khoa_an_toan': sensor_data['khoa_an_toan'],
            'so_lan_su_dung': sensor_data['so_lan_su_dung'],
            'tong_thoi_gian_su_dung': sensor_data['tong_thoi_gian_su_dung'],
            'history': sensor_data['history'][-20:]
        })

# Thêm endpoint này vào file microwave_web_server.py
@app.route('/api/status')
def get_status():
    """Trả về trạng thái thiết bị cho Energy Manager"""
    return jsonify({
        'device_id': sensor_data['device_id'],
        'device_type': 'MICROWAVE',
        'name': 'Lò vi sóng thông minh',
        'status': 'running' if sensor_data['dang_hoat_dong'] else 'idle',
        'power_consumption': sensor_data['cong_suat'] if sensor_data['dang_hoat_dong'] else 0
    })

@app.route('/api/control', methods=['POST'])
def control_handler():
    """Nhận lệnh điều khiển từ web và gửi đến cảm biến"""
    global command_queue
    
    command = request.json
    command_queue.append(command)
    
    return jsonify({
        'success': True,
        'message': f'Đã gửi lệnh {command.get("command")} đến thiết bị'
    })

def main():
    """Khởi động web server"""
    print("="*60)
    print("🔬 DIGITAL TWIN - LÒ VI SÓNG THÔNG MINH")
    print("="*60)
    print("📍 Server đang chạy tại: http://localhost:3002")
    print("📡 Đang chờ kết nối từ cảm biến lò vi sóng...")
    print("="*60)
    print("⚠️  Hãy chạy microwave_simulator.py ở terminal khác!")
    print("="*60)
    
    app.run(host='0.0.0.0', port=3002, debug=True, use_reloader=False)

if __name__ == '__main__':
    main()
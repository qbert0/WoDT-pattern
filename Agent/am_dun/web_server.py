from flask import Flask, render_template_string, jsonify, request
from flask_cors import CORS
import threading
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Lưu trữ dữ liệu từ cảm biến
sensor_data = {
    'device_id': 'AM1001',
    'last_update': None,
    'nhiet_do': 25.0,
    'dang_dun': False,
    'nhiet_do_muc_tieu': 100,
    'muc_nuoc': 1.5,
    'cong_suat': 2000,
    'trang_thai': 'TAT',
    'history': []  # Lưu lịch sử nhiệt độ
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
    <title>Digital Twin - Ấm Đun Nước Thông Minh</title>
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
            max-width: 1200px;
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
        
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
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
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
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
        
        .temperature {
            text-align: center;
            padding: 20px;
        }
        
        .temp-value {
            font-size: 4em;
            font-weight: bold;
            color: #ff6b6b;
        }
        
        .temp-unit {
            font-size: 1.5em;
            color: #666;
        }
        
        .temp-target {
            margin-top: 10px;
            color: #666;
        }
        
        .status {
            text-align: center;
            padding: 15px;
            border-radius: 10px;
            margin-top: 10px;
        }
        
        .status.heating {
            background: #ff6b6b;
            color: white;
            animation: pulse 1s infinite;
        }
        
        .status.idle {
            background: #51cf66;
            color: white;
        }
        
        .status.completed {
            background: #ffd43b;
            color: #333;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.8; }
            100% { opacity: 1; }
        }
        
        .water-level {
            margin: 20px 0;
        }
        
        .water-bar {
            width: 100%;
            height: 30px;
            background: #e0e0e0;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .water-fill {
            height: 100%;
            background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
            transition: width 0.3s;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 10px;
            color: white;
            font-weight: bold;
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
        
        input[type="number"] {
            width: 100%;
            padding: 10px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 1em;
            transition: border-color 0.3s;
        }
        
        input[type="number"]:focus {
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
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
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
        }
        
        .history-time {
            color: #999;
            font-size: 0.9em;
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
        
        .warning p {
            color: #856404;
            margin: 0;
        }
        
        .physical-note {
            background: #e7f3ff;
            border-left: 4px solid #2196f3;
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
        }
        
        .physical-note h4 {
            color: #1976d2;
            margin-bottom: 10px;
        }
        
        .physical-note ul {
            margin-left: 20px;
            color: #555;
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
            
            .temp-value {
                font-size: 3em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🫖 Digital Twin - Ấm Đun Nước</h1>
            <p>Mô phỏng thời gian thực từ cảm biến vật lý</p>
            <div class="device-id" id="deviceId">Đang kết nối...</div>
        </div>
        
        <div class="dashboard">
            <!-- Card Nhiệt độ -->
            <div class="card">
                <h3>🌡️ Nhiệt độ</h3>
                <div class="temperature">
                    <div class="temp-value">
                        <span id="tempValue">--</span><span class="temp-unit">°C</span>
                    </div>
                    <div class="temp-target">
                        Mục tiêu: <span id="targetTemp">--</span>°C
                    </div>
                    <div class="status" id="statusDisplay">Đang tải...</div>
                </div>
            </div>
            
            <!-- Card Lượng nước -->
            <div class="card">
                <h3>💧 Lượng nước</h3>
                <div class="water-level">
                    <div class="water-bar">
                        <div class="water-fill" id="waterFill" style="width: 0%">
                            <span id="waterText">0L</span>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                        <span>0L</span>
                        <span id="maxWater">2.0L</span>
                    </div>
                </div>
                <div class="warning">
                    <p>⚠️ <strong>Lưu ý:</strong> Thêm/đổ nước chỉ có thể thực hiện trên thiết bị vật lý!</p>
                </div>
            </div>
            
            <!-- Card Điều khiển -->
            <div class="card">
                <h3>🎮 Điều khiển từ xa</h3>
                <div class="control-group">
                    <label>Nhiệt độ mục tiêu (25-100°C):</label>
                    <input type="number" id="targetTempInput" min="25" max="100" value="100">
                </div>
                <div class="control-group">
                    <button id="setTempBtn" onclick="setTargetTemperature()">🎯 Đặt nhiệt độ mục tiêu</button>
                </div>
                <div class="control-group">
                    <button id="startHeatBtn" onclick="startHeating()">🔥 Bắt đầu đun</button>
                </div>
                <div class="control-group">
                    <button id="stopHeatBtn" onclick="stopHeating()">⏹️ Dừng đun</button>
                </div>
            </div>
        </div>
        
        <!-- Card Lịch sử -->
        <div class="card">
            <h3>📊 Lịch sử nhiệt độ</h3>
            <div class="history" id="historyList">
                <div class="history-item">Đang cập nhật...</div>
            </div>
        </div>
        
        <div class="physical-note">
            <h4>🔧 Thao tác vật lý (chỉ thực hiện trên thiết bị)</h4>
            <ul>
                <li><strong>💧 Thêm nước:</strong> Mở nắp ấm và đổ nước vào</li>
                <li><strong>🚰 Đổ nước:</strong> Rót nước ra khỏi ấm</li>
                <li><strong>📡 Cảm biến:</strong> Tự động gửi nhiệt độ và trạng thái mỗi giây</li>
            </ul>
            <p style="margin-top: 10px; color: #1976d2;">✅ Các thao tác trên sẽ được cập nhật tự động qua cảm biến!</p>
        </div>
        
        <div class="timestamp">
            Last update: <span id="lastUpdate">--</span>
        </div>
    </div>
    
    <script>
        // Cập nhật dữ liệu mỗi 2 giây
        function fetchData() {
            fetch('/api/sensor-data')
                .then(response => response.json())
                .then(data => {
                    // Cập nhật nhiệt độ
                    document.getElementById('tempValue').textContent = data.nhiet_do;
                    document.getElementById('targetTemp').textContent = data.nhiet_do_muc_tieu;
                    document.getElementById('deviceId').textContent = data.device_id;
                    
                    // Cập nhật trạng thái
                    const statusDiv = document.getElementById('statusDisplay');
                    if (data.dang_dun) {
                        statusDiv.textContent = '🔥 ĐANG ĐUN NƯỚC';
                        statusDiv.className = 'status heating';
                    } else if (data.trang_thai === 'HOAN_THANH') {
                        statusDiv.textContent = '✅ NƯỚC ĐÃ SÔI';
                        statusDiv.className = 'status completed';
                    } else {
                        statusDiv.textContent = '💤 TẮT / CHỜ';
                        statusDiv.className = 'status idle';
                    }
                    
                    // Cập nhật lượng nước
                    const waterPercent = (data.muc_nuoc / 2.0) * 100;
                    document.getElementById('waterFill').style.width = waterPercent + '%';
                    document.getElementById('waterText').textContent = data.muc_nuoc + 'L';
                    document.getElementById('maxWater').textContent = '2.0L';
                    
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
        
        // Gửi lệnh điều khiển
        function sendCommand(command, temperature = null) {
            const data = { command: command };
            if (temperature !== null) {
                data.temperature = temperature;
            }
            
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
        
        function startHeating() {
            const targetTemp = document.getElementById('targetTempInput').value;
            sendCommand('start_heat', parseFloat(targetTemp));
        }
        
        function stopHeating() {
            sendCommand('stop_heat');
        }
        
        function setTargetTemperature() {
            const targetTemp = document.getElementById('targetTempInput').value;
            sendCommand('set_target_temp', parseFloat(targetTemp));
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
            'temp': sensor_data['nhiet_do'],
            'status': 'Đang đun' if sensor_data['dang_dun'] else 'Tắt'
        })
        
        # Giữ 50 bản ghi gần nhất
        if len(sensor_data['history']) > 10:
            sensor_data['history'] = sensor_data['history'][-50:]
        
        # Trả về lệnh điều khiển nếu có
        if command_queue:
            return jsonify(command_queue.pop(0))
        return jsonify({'status': 'ok'})
    
    else:  # GET
        # Trả về dữ liệu hiện tại cho web
        return jsonify({
            'device_id': sensor_data['device_id'],
            'nhiet_do': sensor_data['nhiet_do'],
            'dang_dun': sensor_data['dang_dun'],
            'nhiet_do_muc_tieu': sensor_data['nhiet_do_muc_tieu'],
            'muc_nuoc': sensor_data['muc_nuoc'],
            'trang_thai': sensor_data['trang_thai'],
            'history': sensor_data['history'][-20:]  # Trả về 20 bản ghi gần nhất
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

# Thêm endpoint này vào file web_server.py của ấm đun nước
@app.route('/api/status')
def get_status():
    """Trả về trạng thái thiết bị cho Energy Manager"""
    return jsonify({
        'device_id': sensor_data['device_id'],
        'device_type': 'AM_DUN_NUOC',
        'name': 'Ấm đun nước thông minh',
        'status': 'running' if sensor_data['dang_dun'] else 'idle',
        'power_consumption': 2000 if sensor_data['dang_dun'] else 0
    })

def main():
    """Khởi động web server"""
    print("="*60)
    print("🌐 DIGITAL TWIN - WEB SERVER")
    print("="*60)
    print("📍 Server đang chạy tại: http://localhost:3001")
    print("📡 Đang chờ kết nối từ cảm biến ấm đun nước...")
    print("="*60)
    print("⚠️  Hãy chạy sensor_simulator.py ở terminal khác!")
    print("="*60)
    
    app.run(host='0.0.0.0', port=3001, debug=True, use_reloader=False)

if __name__ == '__main__':
    main()
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const axios = require('axios');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Lưu trữ dữ liệu
class Device {
    constructor(id, name, type, ip, port, technology) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.ip = ip;
        this.port = port;
        this.technology = technology; // python, nodejs, go, java, etc.
        this.status = 'offline';
        this.powerConsumption = 0;
        this.lastUpdate = null;
        this.apiUrl = `http://${ip}:${port}`;
    }
}

class EnergyManager {
    constructor(totalPowerLimit = 3000) {
        this.devices = new Map();
        this.taskQueue = [];
        this.currentTask = null;
        this.totalPowerLimit = totalPowerLimit;
        this.currentPowerUsage = 0;
        this.breakfastMode = false;
        this.wsClients = new Set();
    }

    async addDevice(deviceInfo) {
        const { id, name, type, ip, port, technology } = deviceInfo;
        
        try {
            // Kiểm tra kết nối với thiết bị
            const response = await axios.get(`http://${ip}:${port}/api/status`, { timeout: 3000 });
            if (response.status === 200) {
                const device = new Device(id, name, type, ip, port, technology);
                device.status = response.data.status || 'idle';
                device.powerConsumption = response.data.powerConsumption || 0;
                this.devices.set(id, device);
                
                // Broadcast cho tất cả clients
                this.broadcast({ type: 'device_added', device: this.getDeviceInfo(device) });
                return { success: true, message: `Đã thêm ${name} (${technology}) thành công` };
            }
        } catch (error) {
            return { success: false, message: `Không thể kết nối đến thiết bị tại ${ip}:${port}` };
        }
        return { success: false, message: 'Không xác định được lỗi' };
    }

    async startBreakfast() {
        if (this.devices.size === 0) {
            return { success: false, message: 'Chưa có thiết bị nào trong hệ thống' };
        }

        // Tạo hàng chờ cho các thiết bị
        this.taskQueue = [];
        for (const device of this.devices.values()) {
            if (device.status === 'idle') {
                let priority = 2;
                let estimatedPower = 1000;
                let duration = 180;
                
                switch (device.type) {
                    case 'AM_DUN_NUOC':
                        priority = 1;
                        estimatedPower = 2000;
                        duration = 180; // 3 phút
                        break;
                    case 'MICROWAVE':
                        priority = 2;
                        estimatedPower = 1000;
                        duration = 300; // 5 phút
                        break;
                    case 'COFFEE_MAKER':
                        priority = 3;
                        estimatedPower = 1200;
                        duration = 120; // 2 phút
                        break;
                }
                
                this.taskQueue.push({
                    deviceId: device.id,
                    deviceName: device.name,
                    deviceType: device.type,
                    technology: device.technology,
                    priority: priority,
                    estimatedPower: estimatedPower,
                    duration: duration
                });
            }
        }

        if (this.taskQueue.length === 0) {
            return { success: false, message: 'Không có thiết bị nào sẵn sàng' };
        }

        // Sắp xếp theo độ ưu tiên
        this.taskQueue.sort((a, b) => a.priority - b.priority);
        
        this.breakfastMode = true;
        this.broadcast({ type: 'breakfast_started', queueLength: this.taskQueue.length });
        this.processNextTask();
        
        return { success: true, message: `Đã khởi động bữa sáng với ${this.taskQueue.length} thiết bị` };
    }

    async processNextTask() {
        if (this.taskQueue.length === 0) {
            this.breakfastMode = false;
            this.currentTask = null;
            this.broadcast({ type: 'breakfast_completed' });
            console.log('✅ Đã hoàn thành tất cả các nhiệm vụ bữa sáng!');
            return;
        }

        this.currentTask = this.taskQueue.shift();
        const device = this.devices.get(this.currentTask.deviceId);
        
        if (!device) {
            this.processNextTask();
            return;
        }

        try {
            let command = {};
            switch (device.type) {
                case 'AM_DUN_NUOC':
                    command = { command: 'start_heat', temperature: 100 };
                    break;
                case 'MICROWAVE':
                    command = { command: 'auto_program', program: 'SUOI_AM' };
                    break;
                case 'COFFEE_MAKER':
                    command = { command: 'brew', strength: 'medium' };
                    break;
            }
            
            const response = await axios.post(`${device.apiUrl}/api/control`, command, { timeout: 5000 });
            
            if (response.status === 200) {
                console.log(`🔄 Đang chạy: ${this.currentTask.deviceName} (${device.technology}) - Công suất: ${this.currentTask.estimatedPower}W`);
                this.broadcast({ 
                    type: 'task_started', 
                    task: this.currentTask,
                    technology: device.technology
                });
                
                // Lên lịch kiểm tra hoàn thành
                setTimeout(() => this.checkTaskCompletion(this.currentTask.deviceId), this.currentTask.duration * 1000);
            }
        } catch (error) {
            console.error(`❌ Lỗi khi khởi động ${this.currentTask.deviceName}:`, error.message);
            this.processNextTask();
        }
    }

    async checkTaskCompletion(deviceId) {
        const device = this.devices.get(deviceId);
        if (device) {
            try {
                let stopCommand = {};
                switch (device.type) {
                    case 'AM_DUN_NUOC':
                        stopCommand = { command: 'stop_heat' };
                        break;
                    case 'MICROWAVE':
                        stopCommand = { command: 'stop' };
                        break;
                    case 'COFFEE_MAKER':
                        stopCommand = { command: 'stop' };
                        break;
                }
                await axios.post(`${device.apiUrl}/api/control`, stopCommand, { timeout: 3000 });
                console.log(`✅ Hoàn thành: ${this.currentTask.deviceName}`);
                this.broadcast({ type: 'task_completed', deviceName: this.currentTask.deviceName });
            } catch (error) {
                console.error(`⚠️ Lỗi khi dừng thiết bị:`, error.message);
            }
        }
        this.processNextTask();
    }

    async removeDevice(deviceId) {
        if (this.devices.has(deviceId)) {
            this.devices.delete(deviceId);
            this.broadcast({ type: 'device_removed', deviceId: deviceId });
            return { success: true, message: 'Đã xóa thiết bị' };
        }
        return { success: false, message: 'Không tìm thấy thiết bị' };
    }

    async monitorDevices() {
        setInterval(async () => {
            for (const [id, device] of this.devices) {
                try {
                    const response = await axios.get(`${device.apiUrl}/api/status`, { timeout: 2000 });
                    if (response.status === 200) {
                        device.status = response.data.status;
                        device.powerConsumption = response.data.powerConsumption || 0;
                        device.lastUpdate = new Date().toISOString();
                    }
                } catch (error) {
                    device.status = 'offline';
                }
            }
            this.broadcast({ type: 'devices_update', devices: this.getAllDevices() });
        }, 3000);
    }

    getAllDevices() {
        return Array.from(this.devices.values()).map(d => this.getDeviceInfo(d));
    }

    getDeviceInfo(device) {
        return {
            id: device.id,
            name: device.name,
            type: device.type,
            ip: device.ip,
            port: device.port,
            technology: device.technology,
            status: device.status,
            powerConsumption: device.powerConsumption,
            lastUpdate: device.lastUpdate,
            apiUrl: device.apiUrl
        };
    }

    getEnergyInfo() {
        const totalPower = Array.from(this.devices.values()).reduce((sum, d) => sum + d.powerConsumption, 0);
        return {
            totalPowerLimit: this.totalPowerLimit,
            currentPowerUsage: totalPower,
            remainingPower: this.totalPowerLimit - totalPower,
            breakfastMode: this.breakfastMode,
            currentTask: this.currentTask,
            queueLength: this.taskQueue.length,
            devicesCount: this.devices.size
        };
    }

    broadcast(data) {
        const message = JSON.stringify(data);
        this.wsClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    addWebSocketClient(ws) {
        this.wsClients.add(ws);
        ws.on('close', () => this.wsClients.delete(ws));
    }
}

const manager = new EnergyManager();
manager.monitorDevices();

// WebSocket
wss.on('connection', (ws) => {
    console.log('Client connected');
    manager.addWebSocketClient(ws);
    ws.send(JSON.stringify({ type: 'connected', devices: manager.getAllDevices() }));
});

// API Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/energy_manager.html');
});

app.get('/api/devices', (req, res) => {
    res.json({ devices: manager.getAllDevices() });
});

app.post('/api/add-device', async (req, res) => {
    const { ip, port, technology } = req.body;
    
    // Tạo device ID dựa trên công nghệ
    const techPrefix = {
        'python': 'PY',
        'nodejs': 'ND',
        'go': 'GO',
        'java': 'JV'
    };
    const deviceId = `${techPrefix[technology] || 'DT'}_${ip.replace(/\./g, '_')}_${port}`;
    
    // Xác định loại thiết bị dựa trên port
    let deviceType = 'UNKNOWN';
    let deviceName = 'Thiết bị';
    if (port === 3001) {
        deviceType = 'AM_DUN_NUOC';
        deviceName = 'Ấm đun nước';
    } else if (port === 3002) {
        deviceType = 'MICROWAVE';
        deviceName = 'Lò vi sóng';
    } else if (port === 3003) {
        deviceType = 'COFFEE_MAKER';
        deviceName = 'Máy pha cà phê';
    }
    
    const deviceInfo = {
        id: deviceId,
        name: `${deviceName} (${technology.toUpperCase()})`,
        type: deviceType,
        ip: ip,
        port: port,
        technology: technology
    };
    
    const result = await manager.addDevice(deviceInfo);
    res.json(result);
});

app.post('/api/remove-device', async (req, res) => {
    const { deviceId } = req.body;
    const result = await manager.removeDevice(deviceId);
    res.json(result);
});

app.post('/api/start-breakfast', async (req, res) => {
    const result = await manager.startBreakfast();
    res.json(result);
});

app.get('/api/energy-info', (req, res) => {
    res.json(manager.getEnergyInfo());
});

server.listen(3000, () => {
    console.log('='.repeat(60));
    console.log('⚡ SMART ENERGY MANAGER (Node.js)');
    console.log('='.repeat(60));
    console.log('📍 Server đang chạy tại: http://localhost:3000');
    console.log('🔌 Hỗ trợ các công nghệ: Python, Node.js, Go, Java');
    console.log('='.repeat(60));
});
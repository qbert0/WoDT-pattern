const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Trạng thái lò vi sóng
let microwave = {
    deviceId: 'ND_MICROWAVE_001',
    name: 'Lò vi sóng thông minh (Node.js)',
    deviceType: 'MICROWAVE',
    status: 'idle', // idle, running, paused
    power: 800,
    timeRemaining: 0,
    temperature: 25,
    powerConsumption: 0,
    lastUpdate: new Date().toISOString()
};

// Auto-update nhiệt độ
setInterval(() => {
    if (microwave.status === 'running') {
        // Giảm thời gian
        if (microwave.timeRemaining > 0) {
            microwave.timeRemaining -= 1;
            microwave.temperature += 2;
            microwave.powerConsumption = microwave.power;
            
            if (microwave.timeRemaining <= 0) {
                microwave.status = 'idle';
                microwave.powerConsumption = 0;
                console.log('✅ Lò vi sóng đã hoàn thành!');
            }
        }
    } else if (microwave.status === 'idle' && microwave.temperature > 25) {
        // Nguội dần
        microwave.temperature -= 0.5;
        microwave.temperature = Math.max(microwave.temperature, 25);
        microwave.powerConsumption = 0;
    }
}, 1000);

// API endpoints
app.get('/api/status', (req, res) => {
    res.json({
        device_id: microwave.deviceId,
        device_type: microwave.deviceType,
        name: microwave.name,
        status: microwave.status,
        power_consumption: microwave.powerConsumption,
        temperature: microwave.temperature,
        time_remaining: microwave.timeRemaining
    });
});

app.post('/api/control', (req, res) => {
    const { command, program, seconds, power } = req.body;
    
    switch (command) {
        case 'start':
            if (microwave.timeRemaining > 0) {
                microwave.status = 'running';
                res.json({ success: true, message: 'Đã bắt đầu lò vi sóng' });
            } else {
                res.json({ success: false, message: 'Chưa đặt thời gian' });
            }
            break;
            
        case 'stop':
            microwave.status = 'idle';
            microwave.timeRemaining = 0;
            microwave.powerConsumption = 0;
            res.json({ success: true, message: 'Đã dừng lò vi sóng' });
            break;
            
        case 'pause':
            if (microwave.status === 'running') {
                microwave.status = 'paused';
                res.json({ success: true, message: 'Đã tạm dừng' });
            } else {
                res.json({ success: false, message: 'Không thể tạm dừng' });
            }
            break;
            
        case 'set_time':
            if (seconds && seconds > 0) {
                microwave.timeRemaining = seconds;
                res.json({ success: true, message: `Đã đặt thời gian ${seconds} giây` });
            } else {
                res.json({ success: false, message: 'Thời gian không hợp lệ' });
            }
            break;
            
        case 'set_power':
            if (power && power >= 0 && power <= 100) {
                microwave.power = power * 10;
                res.json({ success: true, message: `Đã đặt công suất ${power}%` });
            } else {
                res.json({ success: false, message: 'Công suất không hợp lệ' });
            }
            break;
            
        case 'auto_program':
            const programs = {
                'BAP_RANG': { time: 180, power: 100 },
                'PIZZA': { time: 300, power: 80 },
                'SUOI_AM': { time: 60, power: 70 }
            };
            
            const prog = programs[program];
            if (prog) {
                microwave.timeRemaining = prog.time;
                microwave.power = prog.power * 10;
                microwave.status = 'running';
                res.json({ success: true, message: `Đang chạy chương trình ${program}` });
            } else {
                res.json({ success: false, message: 'Không tìm thấy chương trình' });
            }
            break;
            
        default:
            res.json({ success: false, message: 'Lệnh không hợp lệ' });
    }
});

app.listen(3002, () => {
    console.log('='.repeat(60));
    console.log('🔬 DIGITAL TWIN - LÒ VI SÓNG (Node.js)');
    console.log('='.repeat(60));
    console.log('📍 Server đang chạy tại: http://localhost:3002');
    console.log('📡 Đang chờ kết nối từ Energy Manager...');
    console.log('='.repeat(60));
});
// Cấu hình kết nối Ditto
const DITTO_CONFIG = {
    baseUrl: 'http://100.104.220.45:8080',
    wsUrl: 'ws://100.104.220.45:8080',
    username: 'ditto',
    password: 'ditto'
};

// Các hằng số khác
const APP_CONFIG = {
    reconnectInterval: 3000,
    maxReconnectAttempts: 20,
    debounceDelay: 300,
    animationDuration: 400
};

//  http://100.104.220.45:8080/
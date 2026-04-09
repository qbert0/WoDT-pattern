const DittoWebSocket = {
    ws: null,
    isConnected: false,
    reconnectAttempts: 0,
    reconnectTimer: null,
    messageCallbacks: [],
    
    onMessage(callback) {
        this.messageCallbacks.push(callback);
    },
    
    _notifyMessage(data) {
        this.messageCallbacks.forEach(cb => cb(data));
    },
    
    _send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    },
    
    _handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this._notifyMessage(data);
        } catch (e) {
            console.error('Parse error:', e);
        }
    },
    
    connect() {
        const wsUrl = `${DITTO_CONFIG.wsUrl}/api/2/things?live=true`;
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            AppState.setWsConnected(true);
            
            // Send auth
            this._send({
                type: 'auth',
                value: `Basic ${btoa(`${DITTO_CONFIG.username}:${DITTO_CONFIG.password}`)}`
            });
            
            // Subscribe to events
            this._send({
                type: 'start-send-events',
                topics: ['_/_/things/twin/events']
            });
        };
        
        this.ws.onmessage = (event) => this._handleMessage(event);
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            AppState.setWsConnected(false);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket closed');
            this.isConnected = false;
            AppState.setWsConnected(false);
            
            // Auto reconnect
            if (this.reconnectAttempts < APP_CONFIG.maxReconnectAttempts) {
                this.reconnectAttempts++;
                this.reconnectTimer = setTimeout(() => {
                    this.connect();
                }, APP_CONFIG.reconnectInterval);
            }
        };
    },
    
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        if (this.ws) {
            this.ws.close();
        }
    }
};
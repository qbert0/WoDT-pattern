const HeaderComponent = {
    element: null,
    totalDevicesSpan: null,
    totalPoliciesSpan: null,
    liveDot: null,
    liveStatusSpan: null,
    
    render() {
        return `
            <div class="header">
                <div class="header-title">
                    <h1>🏠 Smart Home Dashboard</h1>
                    <p>Eclipse Ditto - Digital Twin Platform | Real-time Monitoring</p>
                </div>
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value" id="totalDevices">0</div>
                        <div class="stat-label">Tổng thiết bị</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="totalPolicies">0</div>
                        <div class="stat-label">Số Policy</div>
                    </div>
                    <div class="live-badge">
                        <div class="live-dot" id="liveDot"></div>
                        <span id="liveStatus">LIVE</span>
                    </div>
                </div>
            </div>
        `;
    },
    
    updateStats() {
        if (this.totalDevicesSpan) {
            this.totalDevicesSpan.textContent = AppState.getTotalDevices();
        }
        if (this.totalPoliciesSpan) {
            this.totalPoliciesSpan.textContent = AppState.getTotalPolicies();
        }
    },
    
    updateLiveStatus(connected) {
        if (!this.liveDot || !this.liveStatusSpan) return;
        if (connected) {
            this.liveDot.classList.remove('disconnected');
            this.liveStatusSpan.textContent = 'LIVE';
        } else {
            this.liveDot.classList.add('disconnected');
            this.liveStatusSpan.textContent = 'RECONNECTING...';
        }
    },
    
    mount(selector) {
        const container = document.querySelector(selector);
        if (container) {
            container.innerHTML = this.render();
            this.totalDevicesSpan = document.getElementById('totalDevices');
            this.totalPoliciesSpan = document.getElementById('totalPolicies');
            this.liveDot = document.getElementById('liveDot');
            this.liveStatusSpan = document.getElementById('liveStatus');
        }
    }
};
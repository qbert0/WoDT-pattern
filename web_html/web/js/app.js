// Khởi tạo ứng dụng
document.addEventListener('DOMContentLoaded', async () => {
    // Mount components
    HeaderComponent.mount('#header-root');
    SidebarComponent.mount('#sidebar-root');
    DevicesGridComponent.mount('#devices-root');
    ModalComponent.mount('#modal-root');
    
    // Set callbacks
    SidebarComponent.setOnSelectCallback((policyId) => {
        AppState.setPolicyFilter(policyId);
        SidebarComponent.setActivePolicy(policyId);
    });
    
    DevicesGridComponent.setOnDeviceClick((thingId) => {
        ModalComponent.show(thingId);
    });
    
    // Subscribe to state changes
    AppState.subscribe(() => {
        // Update header stats
        HeaderComponent.updateStats();
        
        // Update sidebar
        SidebarComponent.renderPolicyList();
        
        // Update devices grid
        DevicesGridComponent.renderDevices();
        
        // Update policy filter dropdown
        DevicesGridComponent.updatePolicyFilterDropdown();
    });
    
    // Subscribe to WebSocket messages
    DittoWebSocket.onMessage((msg) => {
        // Handle thing updated
        if (msg.type === 'event' && msg.path && msg.value) {
            const pathParts = msg.path.split('/');
            const thingId = pathParts[0];
            if (thingId) {
                AppState.addOrUpdateThing(msg.value);
                DevicesGridComponent.highlightDevice(thingId);
            }
        }
        // Handle thing created
        else if (msg.type === 'response' && msg.status === 201 && msg.value) {
            const thingId = msg.value.thingId || msg.value._id;
            if (thingId) {
                AppState.addOrUpdateThing(msg.value);
            }
        }
        // Handle thing deleted
        else if (msg.type === 'event:deleted' && msg.path) {
            const thingId = msg.path.split('/')[0];
            if (thingId) {
                AppState.removeThing(thingId);
            }
        }
        // Handle thing modified
        else if (msg.type === 'event:modified' && msg.value) {
            const thingId = msg.value.thingId || msg.value._id;
            if (thingId) {
                AppState.addOrUpdateThing(msg.value);
                DevicesGridComponent.highlightDevice(thingId);
            }
        }
    });
    
    // Subscribe to connection status
    AppState.subscribe(() => {
        HeaderComponent.updateLiveStatus(AppState.wsConnected);
        SidebarComponent.updateConnectionStatus(AppState.wsConnected);
    });
    
    // Load initial data
    try {
        const things = await DittoAPI.getAllThings();
        AppState.setThings(things);
    } catch (error) {
        console.error('Failed to load initial data:', error);
        const grid = document.getElementById('devicesGrid');
        if (grid) {
            grid.innerHTML = `<div class="error-msg">❌ Không thể kết nối tới Ditto tại ${DITTO_CONFIG.baseUrl}<br>Đảm bảo Ditto đang chạy!</div>`;
        }
    }
    
    // Connect WebSocket for real-time
    DittoWebSocket.connect();
});
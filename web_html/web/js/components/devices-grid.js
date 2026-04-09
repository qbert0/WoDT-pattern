const DevicesGridComponent = {
    element: null,
    gridContainer: null,
    searchInput: null,
    policyFilter: null,
    onDeviceClick: null,
    onFilterChange: null,
    debouncedSearch: null,
    
    render() {
        return `
            <div class="devices-section">
                <div class="filter-bar">
                    <input type="text" id="searchInput" placeholder="🔍 Tìm kiếm thiết bị..." class="search-input">
                    <select id="policyFilter" class="policy-filter">
                        <option value="all">📊 Tất cả Policies</option>
                    </select>
                </div>
                <div id="devicesGrid" class="devices-grid">
                    <div class="loading">🔄 Đang tải dữ liệu...</div>
                </div>
            </div>
        `;
    },
    
    renderDevices() {
        const filteredThings = AppState.getFilteredThings();
        const container = document.getElementById('devicesGrid');
        
        if (!container) return;
        
        if (filteredThings.length === 0) {
            container.innerHTML = '<div class="loading">📭 Không có thiết bị nào</div>';
            return;
        }
        
        let html = '';
        for (const thing of filteredThings) {
            const thingId = thing.thingId || thing._id;
            const policyId = thing.policyId || 'no-policy';
            const shortPolicy = Utils.formatPolicyName(policyId);
            const shortName = Utils.formatThingName(thingId);
            const icon = Utils.getDeviceIcon(thingId, thing);
            const temp = Utils.getTemperature(thing);
            const isActive = Utils.isDeviceActive(thing);
            const escapedThingId = thingId.replace(/"/g, '&quot;');
            
            html += `
                <div class="device-card" data-id="${escapedThingId}">
                    <div class="device-icon">${icon}</div>
                    <div class="device-name">${Utils.escapeHtml(shortName)}</div>
                    <div class="device-id">${Utils.escapeHtml(thingId)}</div>
                    <div class="device-policy">📋 ${Utils.escapeHtml(shortPolicy)}</div>
                    ${temp ? `<div class="device-temp">🌡️ ${temp.value}${temp.unit}</div>` : ''}
                    <div class="device-status">
                        <span class="${isActive ? 'status-online' : 'status-offline'}">
                            ${isActive ? '🟢 Đang hoạt động' : '⚪ Tắt/Bật chờ'}
                        </span>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Attach click events
        document.querySelectorAll('.device-card').forEach(card => {
            card.addEventListener('click', () => {
                const thingId = card.dataset.id;
                if (this.onDeviceClick) {
                    this.onDeviceClick(thingId);
                }
            });
        });
    },
    
    updatePolicyFilterDropdown() {
        const counts = AppState.getPolicyCounts();
        const filterSelect = document.getElementById('policyFilter');
        
        if (!filterSelect) return;
        
        let html = '<option value="all">📊 Tất cả Policies</option>';
        const sortedPolicies = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        
        for (const [policyId, count] of sortedPolicies) {
            const shortName = Utils.formatPolicyName(policyId);
            const escapedPolicyId = policyId.replace(/"/g, '&quot;');
            html += `<option value="${escapedPolicyId}">📄 ${Utils.escapeHtml(shortName)} (${count})</option>`;
        }
        
        filterSelect.innerHTML = html;
        filterSelect.value = AppState.currentPolicyFilter;
    },
    
    highlightDevice(thingId) {
        const escapedId = thingId.replace(/"/g, '&quot;');
        const card = document.querySelector(`.device-card[data-id="${escapedId}"]`);
        if (card) {
            card.classList.add('updating');
            setTimeout(() => card.classList.remove('updating'), APP_CONFIG.animationDuration);
        }
    },
    
    getSearchTerm() {
        return this.searchInput ? this.searchInput.value : '';
    },
    
    getSelectedPolicy() {
        return this.policyFilter ? this.policyFilter.value : 'all';
    },
    
    setOnDeviceClick(callback) {
        this.onDeviceClick = callback;
    },
    
    mount(selector) {
        const container = document.querySelector(selector);
        if (container) {
            container.innerHTML = this.render();
            this.searchInput = document.getElementById('searchInput');
            this.policyFilter = document.getElementById('policyFilter');
            
            // Debounced search
            this.debouncedSearch = Utils.debounce((value) => {
                AppState.setSearchTerm(value);
            }, APP_CONFIG.debounceDelay);
            
            if (this.searchInput) {
                this.searchInput.addEventListener('input', (e) => {
                    this.debouncedSearch(e.target.value);
                });
            }
            
            if (this.policyFilter) {
                this.policyFilter.addEventListener('change', (e) => {
                    AppState.setPolicyFilter(e.target.value);
                });
            }
        }
    }
};
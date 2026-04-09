const SidebarComponent = {
    element: null,
    container: null,
    statusDiv: null,
    onPolicySelect: null,
    
    render() {
        return `
            <div class="sidebar">
                <h3>📋 Policies</h3>
                <div id="policyList" class="policy-list">
                    <div class="loading">⏳ Đang tải...</div>
                </div>
                <div class="connection-status" id="connectionStatus"></div>
            </div>
        `;
    },
    
    renderPolicyList() {
        const counts = AppState.getPolicyCounts();
        const container = document.getElementById('policyList');
        
        if (!container) return;
        
        if (counts.size === 0 && AppState.things.size === 0) {
            container.innerHTML = '<div class="loading">📭 Chưa có policy nào</div>';
            return;
        }
        
        let html = '';
        const sortedPolicies = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        
        for (const [policyId, count] of sortedPolicies) {
            const shortName = Utils.formatPolicyName(policyId);
            const escapedPolicyId = policyId.replace(/"/g, '&quot;');
            const isActive = AppState.currentPolicyFilter === policyId;
            const activeClass = isActive ? 'active' : '';
            
            html += `
                <div class="policy-item ${activeClass}" data-policy="${escapedPolicyId}">
                    <div class="policy-name">📄 ${Utils.escapeHtml(shortName)}</div>
                    <div class="policy-count">${count} thiết bị</div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Attach event listeners
        document.querySelectorAll('.policy-item').forEach(el => {
            el.addEventListener('click', () => {
                const policyId = el.dataset.policy;
                if (this.onPolicySelect) {
                    this.onPolicySelect(policyId);
                }
            });
        });
    },
    
    updateConnectionStatus(connected) {
        if (!this.statusDiv) return;
        if (connected) {
            this.statusDiv.innerHTML = '✅ Real-time connection active';
            this.statusDiv.style.color = '#28a745';
        } else {
            this.statusDiv.innerHTML = '⚠️ Mất kết nối, đang thử lại...';
            this.statusDiv.style.color = '#dc3545';
        }
    },
    
    setActivePolicy(policyId) {
        document.querySelectorAll('.policy-item').forEach(el => {
            if (el.dataset.policy === policyId) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    },
    
    setOnSelectCallback(callback) {
        this.onPolicySelect = callback;
    },
    
    mount(selector) {
        const container = document.querySelector(selector);
        if (container) {
            container.innerHTML = this.render();
            this.statusDiv = document.getElementById('connectionStatus');
        }
    }
};
const ModalComponent = {
    modal: null,
    modalTitle: null,
    modalBody: null,
    isVisible: false,
    
    render() {
        return `
            <div id="deviceModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Chi tiết thiết bị</h3>
                        <span class="modal-close" id="modalClose">&times;</span>
                    </div>
                    <div id="modalBody" class="modal-body">
                        <div class="loading">Đang tải...</div>
                    </div>
                </div>
            </div>
        `;
    },
    
    async show(thingId) {
        let thing = AppState.things.get(thingId);
        
        if (!thing) {
            try {
                thing = await DittoAPI.getThing(thingId);
                if (thing) {
                    AppState.addOrUpdateThing(thing);
                }
            } catch (error) {
                this.modalBody.innerHTML = `<div class="error-msg">❌ Không thể tải chi tiết: ${error.message}</div>`;
                this.modal.style.display = 'flex';
                return;
            }
        }
        
        const shortName = Utils.formatThingName(thingId);
        this.modalTitle.textContent = `🔧 ${shortName}`;
        this.modalBody.innerHTML = `<pre>${JSON.stringify(thing, null, 2)}</pre>`;
        this.modal.style.display = 'flex';
        this.isVisible = true;
    },
    
    hide() {
        if (this.modal) {
            this.modal.style.display = 'none';
            this.isVisible = false;
        }
    },
    
    mount(selector) {
        const container = document.querySelector(selector);
        if (container) {
            container.innerHTML = this.render();
            this.modal = document.getElementById('deviceModal');
            this.modalTitle = document.getElementById('modalTitle');
            this.modalBody = document.getElementById('modalBody');
            
            const closeBtn = document.getElementById('modalClose');
            if (closeBtn) {
                closeBtn.onclick = () => this.hide();
            }
            
            window.onclick = (e) => {
                if (e.target === this.modal) {
                    this.hide();
                }
            };
        }
    }
};
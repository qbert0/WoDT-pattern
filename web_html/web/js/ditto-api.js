const DittoAPI = {
    _getAuthHeader() {
        const credentials = btoa(`${DITTO_CONFIG.username}:${DITTO_CONFIG.password}`);
        return `Basic ${credentials}`;
    },
    
    async get(endpoint) {
        const url = `${DITTO_CONFIG.baseUrl}/api/2${endpoint}`;
        const response = await fetch(url, {
            headers: { 'Authorization': this._getAuthHeader() }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    },
    
    async getAllThings() {
        try {
            const things = await this.get('/things');
            return Array.isArray(things) ? things : Object.values(things);
        } catch (error) {
            console.error('Error fetching things:', error);
            throw error;
        }
    },
    
    async getThing(thingId) {
        return this.get(`/things/${encodeURIComponent(thingId)}`);
    }
};
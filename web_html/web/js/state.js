const AppState = {
    // Data
    things: new Map(),
    
    // UI state
    currentPolicyFilter: 'all',
    currentSearchTerm: '',
    
    // Connection
    wsConnected: false,
    reconnectAttempts: 0,
    
    // Subscribers
    subscribers: [],
    
    // Subscribe UI updates
    subscribe(callback) {
        this.subscribers.push(callback);
    },
    
    // Notify all subscribers
    notify() {
        this.subscribers.forEach(cb => cb());
    },
    
    // Set things from API
    setThings(thingsArray) {
        this.things.clear();
        thingsArray.forEach(thing => {
            const thingId = thing.thingId || thing._id;
            if (thingId) {
                this.things.set(thingId, thing);
            }
        });
        this.notify();
    },
    
    // Add or update a thing
    addOrUpdateThing(thing) {
        const thingId = thing.thingId || thing._id;
        if (thingId) {
            const existing = this.things.get(thingId);
            if (existing) {
                this.things.set(thingId, Utils.deepMerge(existing, thing));
            } else {
                this.things.set(thingId, thing);
            }
            this.notify();
            return thingId;
        }
        return null;
    },
    
    // Remove a thing
    removeThing(thingId) {
        if (this.things.has(thingId)) {
            this.things.delete(thingId);
            this.notify();
        }
    },
    
    // Get filtered things
    getFilteredThings() {
        let filtered = [...this.things.values()];
        
        if (this.currentPolicyFilter !== 'all') {
            filtered = filtered.filter(thing => 
                (thing.policyId || 'no-policy') === this.currentPolicyFilter
            );
        }
        
        if (this.currentSearchTerm) {
            const searchLower = this.currentSearchTerm.toLowerCase();
            filtered = filtered.filter(thing => {
                const thingId = (thing.thingId || thing._id || '').toLowerCase();
                const policyId = (thing.policyId || '').toLowerCase();
                return thingId.includes(searchLower) || policyId.includes(searchLower);
            });
        }
        
        return filtered;
    },
    
    // Get policy counts
    getPolicyCounts() {
        const counts = new Map();
        for (const [_, thing] of this.things) {
            const policyId = thing.policyId || 'no-policy';
            counts.set(policyId, (counts.get(policyId) || 0) + 1);
        }
        return counts;
    },
    
    // Set policy filter
    setPolicyFilter(policyId) {
        this.currentPolicyFilter = policyId;
        this.notify();
    },
    
    // Set search term
    setSearchTerm(term) {
        this.currentSearchTerm = term;
        this.notify();
    },
    
    // Set connection status
    setWsConnected(connected) {
        this.wsConnected = connected;
        this.notify();
    },
    
    // Get total devices
    getTotalDevices() {
        return this.things.size;
    },
    
    // Get total policies
    getTotalPolicies() {
        return this.getPolicyCounts().size;
    }
};
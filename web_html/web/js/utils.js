const Utils = {
    // Escape HTML
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    },
    
    // Deep merge object
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    },
    
    // Lấy icon theo thiết bị
    getDeviceIcon(thingId, thing) {
        const id = (thingId || '').toLowerCase();
        if (id.includes('kettle')) return '🫖';
        if (id.includes('coffee')) return '☕';
        if (id.includes('oven')) return '🔥';
        if (id.includes('lamp') || id.includes('light')) return '💡';
        if (id.includes('thermo') || id.includes('temp')) return '🌡️';
        if (thing?.features?.cooking) return '🍳';
        if (thing?.features?.brew) return '☕';
        if (thing?.features?.water) return '💧';
        return '🔌';
    },
    
    // Lấy nhiệt độ
    getTemperature(thing) {
        if (!thing?.features) return null;
        const features = thing.features;
        if (features.water?.properties?.temperature) {
            return { value: features.water.properties.temperature, unit: '°C', label: 'Nhiệt độ nước' };
        }
        if (features.brew?.properties?.waterTemperature) {
            return { value: features.brew.properties.waterTemperature, unit: '°C', label: 'Nhiệt độ nước' };
        }
        if (features.cooking?.properties?.temperature) {
            return { value: features.cooking.properties.temperature, unit: '°C', label: 'Nhiệt độ lò' };
        }
        return null;
    },
    
    // Kiểm tra thiết bị đang hoạt động
    isDeviceActive(thing) {
        if (!thing?.features) return false;
        const power = thing.features.power?.properties;
        const status = thing.features.status?.properties;
        return power?.status === 'on' || 
               status?.state === 'cooking' || 
               status?.state === 'boiling' || 
               status?.state === 'brewing';
    },
    
    // Format policy name
    formatPolicyName(policyId) {
        if (!policyId || policyId === 'no-policy') return 'Không có policy';
        return policyId.includes(':') ? policyId.split(':').pop() : policyId;
    },
    
    // Format thing name
    formatThingName(thingId) {
        if (!thingId) return 'Unknown';
        return thingId.includes(':') ? thingId.split(':').pop() : thingId;
    },
    
    // Debounce
    debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
};
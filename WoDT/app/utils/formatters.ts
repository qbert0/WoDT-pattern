// utils/helpers.ts (hoặc utils/index.ts)
// Nuxt tự động import trực tiếp các hàm này, bạn cứ thế gọi escapeHtml(), getDeviceIcon() ở mọi nơi.

export const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
};

export const deepMerge = (target: any, source: any): any => {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
};

export const getDeviceIcon = (thingId: string, thing?: any): string => {
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
};

export const getTemperature = (thing: any) => {
  const features = thing?.features;
  if (!features) return null;

  if (features.water?.properties?.temperature) return { value: features.water.properties.temperature, unit: '°C', label: 'Nhiệt độ nước' };
  if (features.brew?.properties?.waterTemperature) return { value: features.brew.properties.waterTemperature, unit: '°C', label: 'Nhiệt độ nước' };
  if (features.cooking?.properties?.temperature) return { value: features.cooking.properties.temperature, unit: '°C', label: 'Nhiệt độ lò' };
  return null;
};

export const isDeviceActive = (thing: any): boolean => {
  const state = thing?.features?.status?.properties?.state;
  const power = thing?.features?.power?.properties?.status;
  return power === 'on' || ['cooking', 'boiling', 'brewing'].includes(state);
};

export const formatPolicyName = (policyId: string): string => 
  (!policyId || policyId === 'no-policy') ? 'Không có policy' : policyId.split(':').pop()!;

export const formatThingName = (thingId: string): string => 
  !thingId ? 'Unknown' : thingId.split(':').pop()!;

// Khai báo kiểu chuẩn để ReturnType không bị mất logic của hàm ban đầu
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};
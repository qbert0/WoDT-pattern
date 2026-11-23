export const STATUS_LABELS = {
  online: 'Trực tuyến',
  offline: 'Ngoại tuyến',
  unknown: 'Chưa xác định',
};

export function getTwinStatus(thing, now = Date.now()) {
  const explicit = thing.features?.ConnectionStatus?.properties?.status;
  if (typeof explicit === 'string') {
    const status = explicit.toLowerCase();
    if (status === 'online' || status === 'offline') return status;
    return 'unknown';
  }
  const modified = Date.parse(thing._modified);
  if (!Number.isFinite(modified) || modified > now + 60_000) return 'unknown';
  return now - modified < 300_000 ? 'online' : 'offline';
}

export function getTwinMetrics(thing) {
  const features = thing.features || {};
  const water = features.water?.properties;
  const beans = features.beans?.properties;
  const grinder = features.grinder?.properties;
  const components = features.components?.properties?.thingIds;
  if (water && typeof water.temperature === 'number')
    return [
      { label: 'Nhiệt độ', value: water.temperature, unit: '°C' },
      { label: 'Mực nước', value: water.waterLevel, unit: '%' },
    ];
  if (beans && typeof beans.beanAmount === 'number')
    return [
      { label: 'Lượng hạt', value: beans.beanAmount },
      {
        label: 'Thời gian còn lại',
        value: grinder?.grindDurationSeconds,
        unit: 's',
      },
    ];
  if (Array.isArray(components) && components.length)
    return [
      { label: 'Bản sao thành phần', value: components.length },
      {
        label: 'Tính năng',
        value: Object.keys(features).filter((key) => key !== 'ConnectionStatus')
          .length,
      },
    ];
  const metrics = Object.entries(features)
    .filter(([key]) => key !== 'ConnectionStatus')
    .flatMap(([feature, data]) =>
      Object.entries(data.properties || {})
        .filter(([, value]) => typeof value === 'number')
        .map(([key, value]) => ({ label: `${feature} / ${key}`, value })),
    )
    .slice(0, 2);
  return metrics.length
    ? metrics
    : [
        {
          label: 'Tính năng',
          value: Object.keys(features).filter(
            (key) => key !== 'ConnectionStatus',
          ).length,
        },
      ];
}

export function formatMetric(value) {
  if (value === undefined || value === null || !Number.isFinite(value))
    return '—';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatUpdated(timestamp) {
  const date = new Date(timestamp);
  if (!timestamp || !Number.isFinite(date.getTime())) return 'Chưa có cập nhật';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

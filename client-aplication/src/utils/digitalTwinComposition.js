const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const normalizeStringList = (values) => {
  if (!Array.isArray(values)) return [];

  return [...new Set(values
    .filter(value => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean))];
};

export const normalizeThingCatalog = (things, currentThingId = '') => {
  const normalizedCurrentThingId = typeof currentThingId === 'string'
    ? currentThingId.trim()
    : '';
  const thingIds = new Set();

  if (Array.isArray(things)) {
    things.forEach((thing) => {
      if (!isPlainObject(thing) || typeof thing.thingId !== 'string') return;

      const thingId = thing.thingId.trim();
      if (!thingId || thingId === normalizedCurrentThingId) return;

      thingIds.add(thingId);
    });
  }

  return { thingIds: [...thingIds].sort((left, right) => left.localeCompare(right)) };
};

export const mergeCompositionIntoPayload = (basePayload, { goalAgentId, thingIds } = {}) => {
  const payload = isPlainObject(basePayload) ? { ...basePayload } : {};
  const attributes = isPlainObject(payload.attributes) ? { ...payload.attributes } : {};
  const features = isPlainObject(payload.features) ? { ...payload.features } : {};
  const components = isPlainObject(features.components) ? { ...features.components } : {};
  const properties = isPlainObject(components.properties) ? { ...components.properties } : {};
  const normalizedThingIds = normalizeStringList(thingIds);

  delete attributes.goalRootId;
  attributes.goalAgentId = typeof goalAgentId === 'string' ? goalAgentId.trim() : '';

  if (normalizedThingIds.length > 0) {
    properties.thingIds = normalizedThingIds;
    components.properties = properties;
    features.components = components;
  } else {
    delete properties.thingIds;

    if (Object.keys(properties).length > 0) {
      components.properties = properties;
    } else {
      delete components.properties;
    }

    if (Object.keys(components).length > 0) {
      features.components = components;
    } else {
      delete features.components;
    }
  }

  payload.attributes = attributes;
  payload.features = features;
  return payload;
};

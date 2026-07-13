import { describe, expect, it } from 'vitest';
import {
  mergeCompositionIntoPayload,
  normalizeThingCatalog,
} from './digitalTwinComposition';

describe('normalizeThingCatalog', () => {
  it('normalizes, sorts and deduplicates valid Things', () => {
    const result = normalizeThingCatalog([
      { thingId: 'smart-home:kettle', attributes: { goalRootId: ' G_KETTLE ' } },
      { thingId: 'smart-home:grinder', attributes: { goalRootId: 'G_GRINDER' } },
      { thingId: 'smart-home:kettle', attributes: { goalRootId: 'IGNORED' } },
      { thingId: 'smart-home:new', attributes: { goalRootId: 'G_NEW' } },
      { attributes: { goalRootId: 'G_MISSING_ID' } },
      null,
    ], 'smart-home:new');

    expect(result).toEqual({
      thingIds: ['smart-home:grinder', 'smart-home:kettle'],
    });
  });

  it('ignores malformed Things and empty IDs', () => {
    expect(normalizeThingCatalog([
      { thingId: 'one' },
      { thingId: '   ' },
      { thingId: 123 },
      null,
    ])).toEqual({
      thingIds: ['one'],
    });
  });
});

describe('mergeCompositionIntoPayload', () => {
  it('adds goal root and multiple unique component IDs', () => {
    expect(mergeCompositionIntoPayload({}, {
      goalRootId: ' G_PARENT ',
      thingIds: ['smart-home:grinder', 'smart-home:kettle', 'smart-home:grinder'],
    })).toEqual({
      attributes: { goalRootId: 'G_PARENT' },
      features: {
        components: {
          properties: {
            thingIds: ['smart-home:grinder', 'smart-home:kettle'],
          },
        },
      },
    });
  });

  it('overwrites form-owned fields and preserves unrelated nested data', () => {
    const result = mergeCompositionIntoPayload({
      definition: 'example:definition:1.0.0',
      attributes: { goalRootId: 'OLD', location: 'Lab' },
      features: {
        status: { properties: { online: true } },
        components: {
          definition: ['example:components:1.0.0'],
          properties: { thingIds: ['old:id'], mode: 'serial' },
        },
      },
    }, { goalRootId: 'G_NEW', thingIds: ['new:id'] });

    expect(result).toEqual({
      definition: 'example:definition:1.0.0',
      attributes: { goalRootId: 'G_NEW', location: 'Lab' },
      features: {
        status: { properties: { online: true } },
        components: {
          definition: ['example:components:1.0.0'],
          properties: { thingIds: ['new:id'], mode: 'serial' },
        },
      },
    });
  });

  it('removes thingIds and prunes empty composition objects when none are selected', () => {
    expect(mergeCompositionIntoPayload({
      features: { components: { properties: { thingIds: ['old:id'] } } },
    }, { goalRootId: 'G_PARENT', thingIds: [] })).toEqual({
      attributes: { goalRootId: 'G_PARENT' },
      features: {},
    });
  });

  it('keeps unrelated component properties when removing thingIds', () => {
    expect(mergeCompositionIntoPayload({
      features: { components: { properties: { thingIds: ['old:id'], mode: 'parallel' } } },
    }, { goalRootId: 'G_PARENT' })).toEqual({
      attributes: { goalRootId: 'G_PARENT' },
      features: { components: { properties: { mode: 'parallel' } } },
    });
  });

  it('handles missing, null and non-object payload branches', () => {
    expect(mergeCompositionIntoPayload(null, { goalRootId: 'G_ROOT' })).toEqual({
      attributes: { goalRootId: 'G_ROOT' },
      features: {},
    });
    expect(mergeCompositionIntoPayload({ attributes: [], features: 'invalid' }, {
      goalRootId: 'G_ROOT',
      thingIds: ['child:id'],
    })).toEqual({
      attributes: { goalRootId: 'G_ROOT' },
      features: { components: { properties: { thingIds: ['child:id'] } } },
    });
  });
});

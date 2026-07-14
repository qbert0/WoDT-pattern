import { describe, expect, it } from 'vitest';
import {
  mergeCompositionIntoPayload,
  normalizeThingCatalog,
} from './digitalTwinComposition';

describe('normalizeThingCatalog', () => {
  it('normalizes, sorts and deduplicates valid Things', () => {
    const result = normalizeThingCatalog([
      { thingId: 'smart-home:kettle', attributes: { goalAgentId: ' G_KETTLE ' } },
      { thingId: 'smart-home:grinder', attributes: { goalAgentId: 'G_GRINDER' } },
      { thingId: 'smart-home:kettle', attributes: { goalAgentId: 'IGNORED' } },
      { thingId: 'smart-home:new', attributes: { goalAgentId: 'G_NEW' } },
      { attributes: { goalAgentId: 'G_MISSING_ID' } },
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
  it('adds goal agent and multiple unique component IDs', () => {
    expect(mergeCompositionIntoPayload({}, {
      goalAgentId: ' G_PARENT ',
      thingIds: ['smart-home:grinder', 'smart-home:kettle', 'smart-home:grinder'],
    })).toEqual({
      attributes: { goalAgentId: 'G_PARENT' },
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
      attributes: { goalRootId: 'OLD', goalAgentId: 'OLD_AGENT', location: 'Lab' },
      features: {
        status: { properties: { online: true } },
        components: {
          definition: ['example:components:1.0.0'],
          properties: { thingIds: ['old:id'], mode: 'serial' },
        },
      },
    }, { goalAgentId: 'G_NEW', thingIds: ['new:id'] });

    expect(result).toEqual({
      definition: 'example:definition:1.0.0',
      attributes: { goalAgentId: 'G_NEW', location: 'Lab' },
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
    }, { goalAgentId: 'G_PARENT', thingIds: [] })).toEqual({
      attributes: { goalAgentId: 'G_PARENT' },
      features: {},
    });
  });

  it('keeps unrelated component properties when removing thingIds', () => {
    expect(mergeCompositionIntoPayload({
      features: { components: { properties: { thingIds: ['old:id'], mode: 'parallel' } } },
    }, { goalAgentId: 'G_PARENT' })).toEqual({
      attributes: { goalAgentId: 'G_PARENT' },
      features: { components: { properties: { mode: 'parallel' } } },
    });
  });

  it('handles missing, null and non-object payload branches', () => {
    expect(mergeCompositionIntoPayload(null, { goalAgentId: 'G_ROOT' })).toEqual({
      attributes: { goalAgentId: 'G_ROOT' },
      features: {},
    });
    expect(mergeCompositionIntoPayload({ attributes: [], features: 'invalid' }, {
      goalAgentId: 'G_ROOT',
      thingIds: ['child:id'],
    })).toEqual({
      attributes: { goalAgentId: 'G_ROOT' },
      features: { components: { properties: { thingIds: ['child:id'] } } },
    });
  });
});

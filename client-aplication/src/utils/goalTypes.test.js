import { describe, it, expect } from 'vitest';
import { GOAL_TYPES, normalizeGoalType, requireGoalType } from './goalTypes';

describe('goal type form values', () => {
  it.each(GOAL_TYPES)('reads legacy and canonical %s and writes canonical values', type => {
    expect(normalizeGoalType(type)).toBe(type);
    expect(normalizeGoalType(type.toLowerCase())).toBe(type);
    expect(requireGoalType(type.toLowerCase())).toBe(type);
  });

  it.each([undefined, null, '', 'AND', 'ACHIEVED', 42, {}])('rejects invalid input %s', value => {
    expect(normalizeGoalType(value)).toBeNull();
    expect(() => requireGoalType(value)).toThrow('Goal type');
  });

  it('validates the final type after extra properties override the selection', () => {
    const props = { type: 'Achieve', ...JSON.parse('{"type":"avoid"}') };
    expect(requireGoalType(props.type)).toBe('Avoid');
    expect(() => requireGoalType({ ...props, type: 'AND' }.type)).toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import { getThingGoalAnchor, goalAnchorCandidates, normalizeGoalId } from '../../../goal_model/goals';

describe('Thing goal scope across the ID migration', () => {
  it('keeps an intermediate goal distinct from the scope of its Thing', () => {
    expect(normalizeGoalId('G_ROBOT_ROOT')).toBe('G_R_EXECUTE_TRANSPORT');
    expect(getThingGoalAnchor({ attributes: { goalRootId: 'G_ROBOT_ROOT' } })).toBe('G_WT_TRANSPORT');
    expect(getThingGoalAnchor({ attributes: { goalRootId: 'G_LT_PROVIDE_VERTICAL_TRANSPORT' } })).toBe('G_WT_CROSSFLOOR');
  });
  it('resolves an explicit Agent instead of silently preferring a stale root', () => {
    expect(getThingGoalAnchor({ attributes: { goalRootId: 'G_ROBOT_ROOT', goalAgentId: 'A_ROBOT' } })).toBe('A_ROBOT');
  });
  it('accepts the simulators legacy attribute and unknown user goals', () => {
    expect(getThingGoalAnchor({ attributes: { goalAgentId: 'G_KETTLE_ROOT' } })).toBe('G_K_CONTROL_THERMAL_OUTPUT');
    expect(getThingGoalAnchor({ attributes: { goalAgentId: 'CUSTOM_GOAL' } })).toBe('CUSTOM_GOAL');
    expect(getThingGoalAnchor({ thingId: 'unmapped:thing' })).toBeNull();
  });
  it('prefers a canonical node but can read the pre-migration database', () => {
    expect(goalAnchorCandidates('G_KETTLE_ROOT')).toEqual(['G_K_CONTROL_THERMAL_OUTPUT', 'G_KETTLE_ROOT']);
    expect(goalAnchorCandidates('A_ROBOT')).toEqual(['A_ROBOT']);
  });
});

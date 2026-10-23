export const GOAL_TYPES = Object.freeze(['Achieve', 'Maintain', 'Avoid']);

export function normalizeGoalType(value) {
  if (typeof value !== 'string') return null;
  return GOAL_TYPES.find(type => type.toLowerCase() === value.trim().toLowerCase()) || null;
}

export function requireGoalType(value) {
  const type = normalizeGoalType(value);
  if (!type) throw new Error('Goal type phải là Achieve, Maintain hoặc Avoid.');
  return type;
}

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { loadEnv } from 'vite';
import neo4j from 'neo4j-driver';
import {
  goalAnchorCandidates, GOAL_HIERARCHY_QUERY, GOAL_TARGETS_QUERY,
  GOAL_OWNER_QUERY, GOAL_DEPENDENCIES_QUERY,
} from '../../../goal_model/goals';

// Opt-in: queries the configured database read-only. Never seeds or resets it.
describe.skipIf(process.env.RUN_GOAL_GRAPH_TESTS !== '1')('live goal graph queries', () => {
  let driver;
  beforeAll(() => {
    const env = loadEnv('development', process.cwd(), 'VITE_');
    driver = neo4j.driver(env.VITE_NEO4J_URI, neo4j.auth.basic(env.VITE_NEO4J_USER, env.VITE_NEO4J_PASSWORD));
  });
  afterAll(async () => { await driver?.close(); });
  const query = async (cypher, parameters) => {
    const session = driver.session({ defaultAccessMode: neo4j.session.READ });
    try { return (await session.run(cypher, parameters)).records; }
    finally { await session.close(); }
  };
  it.each([
    ['G_WT_TRANSPORT', 10, 6, ['A_ROBOT']],
    ['G_WT_CROSSFLOOR', 7, 4, ['A_LIFT']],
    ['G_CV_PROVIDE_MATERIAL_FLOW', 4, 3, ['A_CONVEYOR']],
    ['G_Z_MAINTAIN_SAFE_TRAFFIC', 3, 2, ['A_ZONE']],
    ['G_P_PROVIDE_SITUATIONAL_AWARENESS', 3, 2, ['A_PERCEPTION']],
    ['G_K_CONTROL_THERMAL_OUTPUT', 5, 4, ['A_KETTLE']],
    ['G_G_PROVIDE_GROUND_COFFEE', 3, 2, ['A_GRINDER']],
    ['G_WT_FULFILL_OPERATIONS', 32, 22, ['A_ROBOT', 'A_LIFT', 'A_CONVEYOR', 'A_ZONE', 'A_PERCEPTION', 'A_WARETWIN']],
  ])('%s includes only its hierarchy', async (root, goals, tasks, agents) => {
    const params = { anchorGroups: [goalAnchorCandidates(root)] };
    const rows = await query(GOAL_HIERARCHY_QUERY, params);
    const nodes = new Map();
    for (const row of rows) for (const field of row.keys) {
      const path = row.get(field);
      if (!path) continue;
      for (const node of [path.start, path.end, ...path.segments.flatMap(s => [s.start, s.end])]) {
        nodes.set(node.properties.id, node);
      }
      expect(path.segments.some(s => s.relationship.type === 'DEPENDS_ON')).toBe(false);
    }
    const byLabel = label => [...nodes.values()].filter(n => n.labels.includes(label));
    expect(byLabel('Goal')).toHaveLength(goals);
    expect(byLabel('Task')).toHaveLength(tasks);
    expect(byLabel('Agent').map(n => n.properties.id).sort()).toEqual([...agents].sort());
    expect(await query(GOAL_TARGETS_QUERY, params)).toHaveLength(goals);
  });
  it('resolves an Agent and assigns navigation to the nearest responsible Agent', async () => {
    expect(await query(GOAL_TARGETS_QUERY, { anchorGroups: [['A_ROBOT']] })).toHaveLength(10);
    const owner = await query(GOAL_OWNER_QUERY, { goalId: 'G_R_NAVIGATE' });
    expect(owner[0].get('agentId')).toBe('A_ROBOT');
    expect(owner[0].get('rootGoalId')).toBe('G_WT_TRANSPORT');
  });
  it('loads coordination explicitly without walking the dependency target tree', async () => {
    const rows = await query(GOAL_DEPENDENCIES_QUERY, { anchorGroups: [['G_WT_TRANSPORT']], thingId: 'waretwin:robot-R01' });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const path = row.get('dependency');
      expect(path.segments).toHaveLength(1);
      expect(path.segments[0].relationship.type).toBe('DEPENDS_ON');
    }
  });
});

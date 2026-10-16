import renamedIds from './ids.json';

export const normalizeGoalId = (id) => renamedIds[id] || id;

// A Thing's scope is wider than these intermediate transport goals.
export const normalizeScopeId = (id) => {
  const canonical = normalizeGoalId(id);
  return {
    G_R_EXECUTE_TRANSPORT: 'G_WT_TRANSPORT',
    G_LT_PROVIDE_VERTICAL_TRANSPORT: 'G_WT_CROSSFLOOR',
  }[canonical] || canonical;
};

export function getThingGoalAnchor(thing) {
  const attributes = thing?.attributes || {};
  // An explicit Agent is resolved through DELEGATED_TO in Neo4j.
  if (attributes.goalAgentId?.startsWith('A_')) return attributes.goalAgentId;
  const explicit = attributes.goalRootId || attributes.agentGoalRootId || attributes.goalAgentId;
  if (explicit) return normalizeScopeId(explicit);
  const id = String(thing?.thingId || '').toLowerCase();
  if (id.includes('kettle')) return 'G_K_CONTROL_THERMAL_OUTPUT';
  if (id.includes('grinder')) return 'G_G_PROVIDE_GROUND_COFFEE';
  if (id.includes('coffee') || id.includes('system')) return 'G_S_MAKE_COFFEE';
  return null;
}

// Prefer the new ID, with a read-only fallback while the database migrates.
export function goalAnchorCandidates(id) {
  if (!id) return [];
  const canonical = normalizeScopeId(id);
  const legacy = Object.entries(renamedIds).filter(([, value]) => value === canonical).map(([key]) => key);
  return [...new Set([canonical, ...legacy])];
}

// $anchorGroups is one ordered list of candidate IDs per selected Thing.
// Each group resolves to one anchor, even if old and new data coexist briefly.
export const RESOLVE_GOAL_ANCHORS = `
  UNWIND $anchorGroups AS candidates
  CALL {
    WITH candidates
    UNWIND range(0, size(candidates) - 1) AS priority
    MATCH (anchor)
    WHERE anchor.id = candidates[priority] AND (anchor:Goal OR anchor:Agent)
    RETURN anchor ORDER BY priority LIMIT 1
  }
  OPTIONAL MATCH (delegated:Goal)-[:DELEGATED_TO]->(anchor:Agent)
  WITH DISTINCT CASE WHEN anchor:Goal THEN anchor ELSE delegated END AS root
  WHERE root IS NOT NULL
`;

export const GOAL_TARGETS_QUERY = `${RESOLVE_GOAL_ANCHORS}
  MATCH (root)-[:REFINES*0..]->(target:Goal)
  RETURN DISTINCT target
`;

export const GOAL_HIERARCHY_QUERY = `${RESOLVE_GOAL_ANCHORS}
  MATCH path = (root)-[:REFINES*0..]->(goal:Goal)
  OPTIONAL MATCH assignment = (goal)-[:DELEGATED_TO]->(:Agent)
  OPTIONAL MATCH execution = (goal)-[:OPERATIONALIZED_BY]->(:Task)
  RETURN path, assignment, execution
`;

export const GOAL_OWNER_QUERY = `
  MATCH path = (goal:Goal {id: $goalId})<-[:REFINES*0..]-(root:Goal)
  MATCH (root)-[:DELEGATED_TO]->(agent:Agent)
  RETURN root.id AS rootGoalId, agent.id AS agentId, length(path) AS distance
  ORDER BY distance, agentId LIMIT 1
`;

// Coordination adds only the immediate dependency, without traversing its tree.
export const GOAL_DEPENDENCIES_QUERY = `${RESOLVE_GOAL_ANCHORS}
  MATCH (root)-[:REFINES*0..]->(goal:Goal)
  MATCH (goal)-[:OPERATIONALIZED_BY*0..1]->(source)
  MATCH dependency = (source)-[d:DEPENDS_ON]->(target)
  WHERE d.contextId IS NULL OR d.contextId = $thingId
  RETURN DISTINCT dependency
`;

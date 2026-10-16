import { getThingGoalAnchor, goalAnchorCandidates, RESOLVE_GOAL_ANCHORS } from '../../../goal_model/goals'
import { runNeo4jQuery } from './neo4j'

export const resolveThingGoalRoot = async (thing: any): Promise<string | null> => {
  const anchor = getThingGoalAnchor(thing)
  if (!anchor) return null
  const roots = await runNeo4jQuery<{ id: string }>(
    `${RESOLVE_GOAL_ANCHORS} RETURN root.id AS id ORDER BY id`,
    { anchorGroups: [goalAnchorCandidates(anchor)] }
  )
  // Multiple assignments need an explicit choice; never select one arbitrarily.
  return roots.length === 1 ? roots[0]!.id : null
}

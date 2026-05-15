import { executeThingGoal } from '~~/server/utils/digital-twin'

export default defineEventHandler(async (event) => {
  const thingId = getRouterParam(event, 'id')
  const goalId = getRouterParam(event, 'goalId')

  if (!thingId || !goalId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing thing id or goal id' })
  }

  return executeThingGoal(thingId, goalId)
})

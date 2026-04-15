import { executeSystemGoal } from '~~/server/utils/system'

export default defineEventHandler(async (event) => {
  const goalId = getRouterParam(event, 'goalId')
  const body = await readBody<Record<string, any>>(event)

  if (!goalId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing goal id' })
  }

  return executeSystemGoal(goalId, body || {})
})

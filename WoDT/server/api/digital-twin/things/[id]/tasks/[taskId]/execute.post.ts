import { executeThingTask } from '~~/server/utils/digital-twin'

export default defineEventHandler(async (event) => {
  const thingId = getRouterParam(event, 'id')
  const taskId = getRouterParam(event, 'taskId')
  const body = await readBody<Record<string, any>>(event)

  if (!thingId || !taskId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing thing id or task id' })
  }

  return executeThingTask(thingId, taskId, body || {})
})

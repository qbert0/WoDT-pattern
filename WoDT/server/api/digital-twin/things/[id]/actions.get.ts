import { getThingActions } from '~~/server/utils/digital-twin'

export default defineEventHandler(async (event) => {
  const thingId = getRouterParam(event, 'id')

  if (!thingId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing thing id' })
  }

  return getThingActions(thingId)
})

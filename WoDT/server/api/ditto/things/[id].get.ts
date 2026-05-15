import type { DittoThing } from '~/types/ditto'
import { dittoGet } from '~~/server/utils/ditto'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing thing id'
    })
  }

  return await dittoGet<DittoThing>(`/things/${encodeURIComponent(id)}`)
})
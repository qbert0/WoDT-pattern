import type { DittoThing, OverviewResponse } from '~/types/ditto'
import { dittoGet } from '~~/server/utils/ditto'

export default defineEventHandler(async (): Promise<OverviewResponse> => {
  try {
    const raw = await dittoGet<DittoThing[] | Record<string, DittoThing>>('/things')
    const things = Array.isArray(raw) ? raw : Object.values(raw)

    const thingsByPolicy: Record<string, { id: string; policyId: string }[]> = {}

    for (const thing of things) {
      const id = thing.thingId || thing._id
      const policyId = thing.policyId || 'no-policy'

      if (!id) continue

      if (!thingsByPolicy[policyId]) {
        thingsByPolicy[policyId] = []
      }

      thingsByPolicy[policyId].push({ id, policyId })
    }

    const policies = Object.entries(thingsByPolicy).map(([policyId, list]) => ({
      policyId,
      count: list.length
    }))

    return {
      totalThings: things.length,
      totalPolicies: policies.length,
      policies,
      thingsByPolicy
    }
  } catch (error: any) {
    console.error('Ditto overview error:', error)

    throw createError({
      statusCode: error?.statusCode || 500,
      statusMessage: error?.statusMessage || 'Failed to fetch Ditto overview'
    })
  }
})
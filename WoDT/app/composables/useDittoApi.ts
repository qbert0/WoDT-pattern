import type { DittoThing, OverviewResponse } from '~/types/ditto'

export const useDittoApi = () => {
  const getOverview = () => {
    return $fetch<OverviewResponse>('/api/ditto/overview')
  }

  const getAllThings = () => {
    return $fetch<DittoThing[]>('/api/ditto/things')
  }

  const getThing = (thingId: string) => {
    return $fetch<DittoThing>(`/api/ditto/things/${encodeURIComponent(thingId)}`)
  }

  const sendMessage = (
    thingId: string, 
    featureId: string, 
    subject: string, 
    payload: any = {},
    options?: {
      timeout?: number
      requestedAcks?: string
      condition?: string
    }
  ) => {
    return $fetch(`/api/ditto/things/${encodeURIComponent(thingId)}/features/${encodeURIComponent(featureId)}/messages/${encodeURIComponent(subject)}`, {
      method: 'POST',
      body: payload,
      query: {
        timeout: options?.timeout,
        'requested-acks': options?.requestedAcks,
        condition: options?.condition
      }
    })
  }

  return {
    getOverview,
    getAllThings,
    getThing,
    sendMessage
  }

  
}
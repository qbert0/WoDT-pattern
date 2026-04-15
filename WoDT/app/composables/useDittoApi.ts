import type { DittoThing, OverviewResponse, SystemActionsResponse, ThingActionsResponse } from '~/types/ditto'

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

  const getThingActions = (thingId: string) => {
    return $fetch<ThingActionsResponse>(`/api/digital-twin/things/${encodeURIComponent(thingId)}/actions`)
  }

  const executeThingTask = (
    thingId: string,
    taskId: string,
    payload: Record<string, any> = {}
  ) => {
    return $fetch(`/api/digital-twin/things/${encodeURIComponent(thingId)}/tasks/${encodeURIComponent(taskId)}/execute`, {
      method: 'POST',
      body: payload
    })
  }

  const executeThingGoal = (
    thingId: string,
    goalId: string
  ) => {
    return $fetch(`/api/digital-twin/things/${encodeURIComponent(thingId)}/goals/${encodeURIComponent(goalId)}/execute`, {
      method: 'POST'
    })
  }

  const getSystemActions = () => {
    return $fetch<SystemActionsResponse>('/api/system/actions')
  }

  const executeSystemGoal = (
    goalId: string,
    payload: Record<string, any> = {}
  ) => {
    return $fetch(`/api/system/goals/${encodeURIComponent(goalId)}/execute`, {
      method: 'POST',
      body: payload
    })
  }

  return {
    getOverview,
    getAllThings,
    getThing,
    sendMessage,
    getThingActions,
    executeThingTask,
    executeThingGoal,
    getSystemActions,
    executeSystemGoal
  }

  
}

export interface DittoThing {
  thingId?: string
  policyId?: string
  _revision?: number
  attributes?: Record<string, any>
  features?: Record<string, DittoFeature>
  definition?: string
  [key: string]: any
}

export interface DittoFeature {
  properties?: Record<string, any>
  desiredProperties?: Record<string, any> 
  definition?: string[] 
}

export interface ThingSummary {
  id: string
  policyId: string
}

export interface PolicySummary {
  policyId: string
  count: number
}

export interface OverviewResponse {
  totalThings: number
  totalPolicies: number
  policies: PolicySummary[]
  thingsByPolicy: Record<string, ThingSummary[]>
}
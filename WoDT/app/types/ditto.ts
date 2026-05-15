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

export interface InputParameter {
  name: string
  type: string
}

export interface ThingActionTask {
  taskId: string
  taskName: string
  taskCommand: string
  goalId: string
  goalName: string
  dependsOn: string[]
  inputParameters: InputParameter[]
}

export interface ThingGoal {
  goalId: string
  goalName: string
  description?: string
  depth: number
}

export interface ThingActionsResponse {
  thingId: string
  goalRootId: string | null
  goals: ThingGoal[]
  availableGoals: ThingGoal[]
  tasks: ThingActionTask[]
}

export interface SystemThingSummary {
  thingId: string
  policyId: string
  goalRootId: string | null
  features: Record<string, DittoFeature>
}

export interface SystemGoalDependency {
  systemGoalId: string
  targetGoalId: string
  dependencyType: string
  description: string
}

export interface SystemAdvancedInput {
  taskId: string
  taskName: string
  taskCommand: string
  parameterName: string
  label: string
  value: number
  inputType: string
}

export interface SystemRelationSetting {
  relationKey: string
  sourceTaskId: string
  sourceTaskName: string
  sourceParameter: string
  targetTaskId: string
  targetTaskName: string
  targetParameter: string
  factor: number
  offset: number
  description: string
}

export interface SystemActionsResponse {
  systemGoalRootId: string
  goals: ThingGoal[]
  availableGoals: ThingGoal[]
  dependencies: SystemGoalDependency[]
  things: SystemThingSummary[]
  advancedSettings: {
    directParameters: SystemAdvancedInput[]
    relationSettings: SystemRelationSetting[]
  }
}

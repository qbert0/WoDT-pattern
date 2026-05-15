import { dittoGet } from './ditto'
import { executeThingTask } from './digital-twin'
import { runNeo4jQuery } from './neo4j'

type SystemGoalNode = {
  goalId: string
  goalName: string
  description: string
  depth: number
}

type GoalRelation = {
  parentId: string
  childId: string
  refineType: string
}

type GoalDependency = {
  systemGoalId: string
  targetGoalId: string
  dependencyType: string
  description: string
}

type GoalOwner = {
  rootGoalId: string
  agentId: string
}

type GoalTaskRecord = {
  goalId: string
  goalName: string
  taskId: string
  taskName: string
  taskCommand: string
  inputParameters: string
  dependsOn: string[]
}

type ParameterDependency = {
  targetTaskId: string
  targetTaskName: string
  targetTaskCommand: string
  sourceTaskId: string
  sourceTaskName: string
  sourceTaskCommand: string
  sourceParameter: string
  targetParameter: string
  factor: number
  offset: number
  relationType: string
  description: string
}

type SystemAdvancedInput = {
  taskId: string
  taskName: string
  taskCommand: string
  parameterName: string
  label: string
  value: number
  inputType: string
}

type SystemRelationSetting = {
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

type SystemExecutePayload = {
  taskInputs?: Record<string, Record<string, number>>
  relationInputs?: Record<string, { factor?: number; offset?: number }>
}

const SYSTEM_ROOT_GOAL_ID = 'G_SYSTEM_ROOT'

const priorityByTaskCommand: Record<string, number> = {
  SET_VOLUME: 1,
  SET_BEAN_AMOUNT: 1,
  SET_TEMP: 2,
  TURN_ON: 3,
  GRIND: 3,
  TURN_OFF: 4
}

const parseInputParameters = (raw: unknown) => {
  const value = String(raw || '').trim()
  if (!value) return []

  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [name, type] = part.split(':').map(item => item.trim())
      return {
        name: name || 'value',
        type: type || 'string'
      }
    })
}

const formatLabel = (value: string) => {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
}

const inferRootGoalIdFromThing = (thing: any): string | null => {
  const attributes = thing?.attributes || {}
  const explicitRoot = typeof attributes.goalRootId === 'string' ? attributes.goalRootId : ''

  if (explicitRoot) {
    return explicitRoot
  }

  const thingId = String(thing?.thingId || '')
  if (thingId.includes('kettle')) return 'G_KETTLE_ROOT'
  if (thingId.includes('grinder')) return 'G_GRINDER_ROOT'

  return null
}

const getThingFeatureValue = (thing: any, featureId: string, propertyId: string) =>
  thing?.features?.[featureId]?.properties?.[propertyId]

const buildTaskExecutionPayload = (taskCommand: string, params: Record<string, number>) => {
  if (taskCommand === 'SET_TEMP') {
    return {
      temperature: Number(params.temperature)
    }
  }

  if (taskCommand === 'SET_VOLUME') {
    const value = Number(params.volume ?? params.water_level)
    return {
      water_level: value,
      volume: value
    }
  }

  if (taskCommand === 'SET_BEAN_AMOUNT') {
    const value = Number(params.amount ?? params.bean_amount)
    return {
      amount: value,
      bean_amount: value
    }
  }

  return {}
}

const getCurrentThingTaskValue = (taskCommand: string, parameterName: string, thing: any) => {
  if (taskCommand === 'SET_TEMP') {
    return Number(getThingFeatureValue(thing, 'water', 'targetTemperature') ?? 100)
  }

  if (taskCommand === 'SET_VOLUME') {
    return Number(getThingFeatureValue(thing, 'water', 'waterLevel') ?? 0)
  }

  if (taskCommand === 'SET_BEAN_AMOUNT') {
    return Number(
      getThingFeatureValue(thing, 'beans', 'targetAmount')
      ?? getThingFeatureValue(thing, 'beans', 'beanAmount')
      ?? 0
    )
  }

  return Number(thing?.[parameterName] ?? 0)
}

const getGoalTree = async (goalRootId: string) => {
  const goals = await runNeo4jQuery<SystemGoalNode>(
    `
    MATCH path = (g:Goal {id: $goalId})-[:REFINES*0..]->(sub:Goal)
    RETURN DISTINCT
      sub.id AS goalId,
      sub.name AS goalName,
      sub.description AS description,
      length(path) AS depth
    ORDER BY depth, goalId
    `,
    { goalId: goalRootId }
  )

  const relations = await runNeo4jQuery<GoalRelation>(
    `
    MATCH (root:Goal {id: $goalId})-[:REFINES*0..]->(parent:Goal)-[r:REFINES]->(child:Goal)
    RETURN DISTINCT
      parent.id AS parentId,
      child.id AS childId,
      coalesce(r.type, 'AND') AS refineType
    `,
    { goalId: goalRootId }
  )

  return { goals, relations }
}

const getVisibleGoals = (
  goalRootId: string,
  goals: SystemGoalNode[],
  relations: GoalRelation[]
) => {
  const goalMap = new Map(goals.map(goal => [goal.goalId, goal]))
  const childrenByParent = new Map<string, GoalRelation[]>()

  for (const relation of relations) {
    if (!childrenByParent.has(relation.parentId)) {
      childrenByParent.set(relation.parentId, [])
    }
    childrenByParent.get(relation.parentId)!.push(relation)
  }

  const visibleGoalIds: string[] = []

  const visit = (goalId: string) => {
    const childRelations = childrenByParent.get(goalId) || []

    if (!childRelations.length) {
      visibleGoalIds.push(goalId)
      return
    }

    const isOrRefinement = childRelations.every(item => String(item.refineType).toUpperCase() === 'OR')

    if (isOrRefinement) {
      for (const relation of childRelations) {
        visit(relation.childId)
      }
      return
    }

    visibleGoalIds.push(goalId)
  }

  visit(goalRootId)

  return visibleGoalIds
    .map(goalId => goalMap.get(goalId))
    .filter(Boolean)
    .map(goal => ({
      goalId: String(goal!.goalId),
      goalName: String(goal!.goalName),
      description: String(goal!.description || ''),
      depth: Number(goal!.depth || 0)
    }))
}

const getSystemGoalDependencies = async (goalRootId: string) => {
  return runNeo4jQuery<GoalDependency>(
    `
    MATCH (root:Goal {id: $goalId})-[:REFINES*0..]->(systemGoal:Goal)-[d:DEPENDS_ON]->(target:Goal)
    RETURN DISTINCT
      systemGoal.id AS systemGoalId,
      target.id AS targetGoalId,
      coalesce(d.type, 'ACHIEVED') AS dependencyType,
      coalesce(d.description, '') AS description
    `,
    { goalId: goalRootId }
  )
}

const getGoalOwner = async (goalId: string) => {
  const records = await runNeo4jQuery<GoalOwner>(
    `
    MATCH (goal:Goal {id: $goalId})<-[:REFINES*0..]-(root:Goal)-[:DELEGATED_TO]->(agent:Agent)
    RETURN DISTINCT
      root.id AS rootGoalId,
      agent.id AS agentId
    LIMIT 1
    `,
    { goalId }
  )

  return records[0] || null
}

const getAllThings = async () => {
  const raw = await dittoGet<any[] | Record<string, any>>('/things')
  return Array.isArray(raw) ? raw : Object.values(raw)
}

const findThingForGoal = async (goalId: string) => {
  const owner = await getGoalOwner(goalId)
  if (!owner) {
    return null
  }

  const things = await getAllThings()
  return things.find(thing => inferRootGoalIdFromThing(thing) === owner.rootGoalId) || null
}

const buildSystemExecutionOrder = (
  goalId: string,
  relations: GoalRelation[],
  dependencies: GoalDependency[]
) => {
  const childrenByParent = new Map<string, GoalRelation[]>()
  const dependencyTargetsByGoal = new Map<string, string[]>()

  for (const relation of relations) {
    if (!childrenByParent.has(relation.parentId)) {
      childrenByParent.set(relation.parentId, [])
    }
    childrenByParent.get(relation.parentId)!.push(relation)
  }

  for (const dependency of dependencies) {
    if (!dependencyTargetsByGoal.has(dependency.systemGoalId)) {
      dependencyTargetsByGoal.set(dependency.systemGoalId, [])
    }
    dependencyTargetsByGoal.get(dependency.systemGoalId)!.push(dependency.targetGoalId)
  }

  const orderedDeviceGoals: string[] = []

  const visit = (currentGoalId: string) => {
    const childRelations = childrenByParent.get(currentGoalId) || []

    if (childRelations.length) {
      const orderedChildren = [...childRelations].sort((left, right) => left.childId.localeCompare(right.childId))
      for (const relation of orderedChildren) {
        visit(relation.childId)
      }
      return
    }

    const dependencyTargets = dependencyTargetsByGoal.get(currentGoalId) || []
    for (const targetGoalId of dependencyTargets) {
      if (!orderedDeviceGoals.includes(targetGoalId)) {
        orderedDeviceGoals.push(targetGoalId)
      }
    }
  }

  visit(goalId)
  return orderedDeviceGoals
}

const getTasksForGoal = async (goalId: string) => {
  return runNeo4jQuery<GoalTaskRecord>(
    `
    MATCH (g:Goal {id: $goalId})-[:REFINES*0..]->(sub:Goal)-[:OPERATIONALIZED_BY]->(t:Task)
    OPTIONAL MATCH (t)-[:DEPENDS_ON]->(dep:Task)
    RETURN DISTINCT
      sub.id AS goalId,
      sub.name AS goalName,
      t.id AS taskId,
      t.name AS taskName,
      t.command AS taskCommand,
      t.inputParameters AS inputParameters,
      collect(DISTINCT dep.id) AS dependsOn
    ORDER BY taskId
    `,
    { goalId }
  )
}

const getParameterDependencies = async (taskIds: string[]) => {
  if (!taskIds.length) {
    return []
  }

  return runNeo4jQuery<ParameterDependency>(
    `
    MATCH (target:Task)-[d:DEPENDS_ON]->(source:Task)
    WHERE target.id IN $taskIds
      AND source.id IN $taskIds
      AND coalesce(d.type, '') = 'PARAMETER'
    RETURN DISTINCT
      target.id AS targetTaskId,
      target.name AS targetTaskName,
      target.command AS targetTaskCommand,
      source.id AS sourceTaskId,
      source.name AS sourceTaskName,
      source.command AS sourceTaskCommand,
      coalesce(d.sourceParameter, 'amount') AS sourceParameter,
      coalesce(d.targetParameter, 'volume') AS targetParameter,
      coalesce(d.factor, 1.0) AS factor,
      coalesce(d.offset, 0.0) AS offset,
      coalesce(d.type, 'PARAMETER') AS relationType,
      coalesce(d.description, '') AS description
    `,
    { taskIds }
  )
}

const collectSystemExecutionGraph = async (goalId: string) => {
  const { relations } = await getGoalTree(SYSTEM_ROOT_GOAL_ID)
  const dependencies = await getSystemGoalDependencies(SYSTEM_ROOT_GOAL_ID)
  const orderedDeviceGoals = buildSystemExecutionOrder(goalId, relations, dependencies)

  const goalExecutions = []
  const tasks: Array<GoalTaskRecord & { thingId: string }> = []

  for (const deviceGoalId of orderedDeviceGoals) {
    const thing = await findThingForGoal(deviceGoalId)
    const taskRecords = await getTasksForGoal(deviceGoalId)

    if (!thing?.thingId) {
      goalExecutions.push({
        targetGoalId: deviceGoalId,
        thingId: null,
        tasks: []
      })
      continue
    }

    const sortedTasks = [...taskRecords].sort((left, right) => {
      return (priorityByTaskCommand[left.taskCommand] ?? 99) - (priorityByTaskCommand[right.taskCommand] ?? 99)
    })

    goalExecutions.push({
      targetGoalId: deviceGoalId,
      thingId: String(thing.thingId),
      tasks: sortedTasks.map(task => task.taskId)
    })

    for (const task of sortedTasks) {
      tasks.push({
        ...task,
        thingId: String(thing.thingId)
      })
    }
  }

  const parameterDependencies = await getParameterDependencies(tasks.map(task => task.taskId))

  return {
    goalExecutions,
    tasks,
    parameterDependencies
  }
}

const buildSystemAdvancedSettings = async (goalId: string) => {
  const { tasks, parameterDependencies } = await collectSystemExecutionGraph(goalId)
  const incomingParameterTargets = new Set(
    parameterDependencies.map(dep => `${dep.targetTaskId}:${dep.targetParameter}`)
  )
  const things = await getAllThings()
  const thingMap = new Map(things.map(thing => [String(thing.thingId), thing]))

  const directParameters: SystemAdvancedInput[] = []
  for (const task of tasks) {
    const parsedInputs = parseInputParameters(task.inputParameters)
    for (const input of parsedInputs) {
      if (incomingParameterTargets.has(`${task.taskId}:${input.name}`)) {
        continue
      }

      const thing = thingMap.get(task.thingId)
      directParameters.push({
        taskId: task.taskId,
        taskName: task.taskName,
        taskCommand: task.taskCommand,
        parameterName: input.name,
        label: formatLabel(input.name),
        value: getCurrentThingTaskValue(task.taskCommand, input.name, thing),
        inputType: input.type
      })
    }
  }

  const relationSettings: SystemRelationSetting[] = parameterDependencies.map(dep => ({
    relationKey: `${dep.targetTaskId}<-${dep.sourceTaskId}`,
    sourceTaskId: dep.sourceTaskId,
    sourceTaskName: dep.sourceTaskName,
    sourceParameter: dep.sourceParameter,
    targetTaskId: dep.targetTaskId,
    targetTaskName: dep.targetTaskName,
    targetParameter: dep.targetParameter,
    factor: Number(dep.factor ?? 1),
    offset: Number(dep.offset ?? 0),
    description: dep.description
  }))

  return {
    directParameters,
    relationSettings
  }
}

export const getSystemActions = async () => {
  const { goals, relations } = await getGoalTree(SYSTEM_ROOT_GOAL_ID)
  const dependencies = await getSystemGoalDependencies(SYSTEM_ROOT_GOAL_ID)
  const things = await getAllThings()
  const advancedSettings = await buildSystemAdvancedSettings(SYSTEM_ROOT_GOAL_ID)

  return {
    systemGoalRootId: SYSTEM_ROOT_GOAL_ID,
    goals,
    availableGoals: getVisibleGoals(SYSTEM_ROOT_GOAL_ID, goals, relations),
    dependencies,
    things: things.map(thing => ({
      thingId: thing.thingId,
      policyId: thing.policyId,
      goalRootId: inferRootGoalIdFromThing(thing),
      features: thing.features || {}
    })),
    advancedSettings
  }
}

export const executeSystemGoal = async (
  goalId: string,
  payload: SystemExecutePayload = {}
) => {
  const { goalExecutions, tasks, parameterDependencies } = await collectSystemExecutionGraph(goalId)
  const things = await getAllThings()
  const thingMap = new Map(things.map(thing => [String(thing.thingId), thing]))
  const tasksById = new Map(tasks.map(task => [task.taskId, task]))
  const resolvedTaskInputs = new Map<string, Record<string, number>>()

  for (const task of tasks) {
    const parsedInputs = parseInputParameters(task.inputParameters)
    if (!parsedInputs.length) {
      continue
    }

    const provided = payload.taskInputs?.[task.taskId] || {}
    const currentThing = thingMap.get(task.thingId)
    const resolved: Record<string, number> = {}

    for (const input of parsedInputs) {
      if (provided[input.name] !== undefined) {
        resolved[input.name] = Number(provided[input.name])
      } else {
        resolved[input.name] = getCurrentThingTaskValue(task.taskCommand, input.name, currentThing)
      }
    }

    resolvedTaskInputs.set(task.taskId, resolved)
  }

  for (const dependency of parameterDependencies) {
    const relationKey = `${dependency.targetTaskId}<-${dependency.sourceTaskId}`
    const relationOverride = payload.relationInputs?.[relationKey] || {}
    const factor = Number(relationOverride.factor ?? dependency.factor ?? 1)
    const offset = Number(relationOverride.offset ?? dependency.offset ?? 0)

    const sourceInputs = resolvedTaskInputs.get(dependency.sourceTaskId) || {}
    const sourceValue = Number(sourceInputs[dependency.sourceParameter] ?? 0)
    const targetInputs = resolvedTaskInputs.get(dependency.targetTaskId) || {}
    targetInputs[dependency.targetParameter] = (sourceValue * factor) + offset
    resolvedTaskInputs.set(dependency.targetTaskId, targetInputs)
  }

  const executions = []

  for (const goalExecution of goalExecutions) {
    if (!goalExecution.thingId) {
      executions.push({
        targetGoalId: goalExecution.targetGoalId,
        status: 'skipped',
        reason: 'No mapped thing found for goal'
      })
      continue
    }

    const taskExecutions = []

    for (const taskId of goalExecution.tasks) {
      const task = tasksById.get(taskId)
      if (!task) {
        continue
      }

      const params = resolvedTaskInputs.get(task.taskId) || {}
      const result = await executeThingTask(
        goalExecution.thingId,
        task.taskId,
        buildTaskExecutionPayload(task.taskCommand, params)
      )

      taskExecutions.push({
        taskId: task.taskId,
        taskName: task.taskName,
        taskCommand: task.taskCommand,
        params,
        result
      })
    }

    executions.push({
      targetGoalId: goalExecution.targetGoalId,
      thingId: goalExecution.thingId,
      taskExecutions
    })
  }

  return {
    success: true,
    goalId,
    executions
  }
}
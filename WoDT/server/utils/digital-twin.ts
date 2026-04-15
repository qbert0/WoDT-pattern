import { dittoGet } from './ditto'
import { runNeo4jQuery } from './neo4j'

type InputParameter = {
  name: string
  type: string
}

type GoalNode = {
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

type GoalTaskRecord = {
  goalId: string
  goalName: string
  taskId: string
  taskName: string
  taskCommand: string
  inputParameters: string
  dependsOn: string[]
}

const taskCommandToDeviceCommand: Record<string, string> = {
  TURN_ON: 'turn_on',
  TURN_OFF: 'turn_off',
  SET_TEMP: 'set_target_temperature',
  SET_VOLUME: 'set_water_level',
  GRIND: 'grind',
  SET_BEAN_AMOUNT: 'set_bean_amount'
}

const DIRECT_DT_MQTT_BROKER_URL = 'mqtt://100.104.220.45:1883'
const DIRECT_DT_COMMAND_TOPIC = (thingId: string) => `ditto/things/${thingId}/inbox/messages/direct-web`

const publishDirectDtCommand = async (thingId: string, deviceCommand: string, params: Record<string, any>) => {
  const { connectAsync } = await import('mqtt')
  const client = await connectAsync(DIRECT_DT_MQTT_BROKER_URL)

  try {
    await client.publishAsync(
      DIRECT_DT_COMMAND_TOPIC(thingId),
      JSON.stringify({
        value: {
          [deviceCommand]: params
        }
      }),
      { qos: 0 }
    )
  } finally {
    await client.endAsync()
  }
}

const parseInputParameters = (raw: unknown): InputParameter[] => {
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

const inferGoalRootId = (thing: any): string | null => {
  const attributes = thing?.attributes || {}

  if (typeof attributes.goalRootId === 'string' && attributes.goalRootId) {
    return attributes.goalRootId
  }

  if (typeof attributes.agentGoalRootId === 'string' && attributes.agentGoalRootId) {
    return attributes.agentGoalRootId
  }

  const thingId = String(thing?.thingId || '')
  if (thingId.includes('kettle')) return 'G_KETTLE_ROOT'
  if (thingId.includes('grinder')) return 'G_GRINDER_ROOT'

  return null
}

const priorityByTaskCommand: Record<string, number> = {
  SET_VOLUME: 1,
  SET_BEAN_AMOUNT: 1,
  SET_TEMP: 2,
  TURN_ON: 3,
  GRIND: 3,
  TURN_OFF: 4
}

const getThingFeatureValue = (thing: any, featureId: string, propertyId: string) =>
  thing?.features?.[featureId]?.properties?.[propertyId]

const buildParamsFromCurrentThing = (taskCommand: string, thing: any) => {
  if (taskCommand === 'SET_TEMP') {
    return {
      temperature: Number(getThingFeatureValue(thing, 'water', 'targetTemperature') ?? 100)
    }
  }

  if (taskCommand === 'SET_VOLUME') {
    return {
      water_level: Number(getThingFeatureValue(thing, 'water', 'waterLevel') ?? 0)
    }
  }

  if (taskCommand === 'SET_BEAN_AMOUNT') {
    return {
      amount: Number(
        getThingFeatureValue(thing, 'beans', 'targetAmount')
        ?? getThingFeatureValue(thing, 'beans', 'beanAmount')
        ?? 0
      )
    }
  }

  return {}
}

const getGoalTree = async (goalRootId: string) => {
  const goals = await runNeo4jQuery<GoalNode>(
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

  const relationsRaw = await runNeo4jQuery<GoalRelation>(
    `
    MATCH (root:Goal {id: $goalId})-[:REFINES*0..]->(parent:Goal)-[r:REFINES]->(child:Goal)
    RETURN DISTINCT
      parent.id AS parentId,
      child.id AS childId,
      coalesce(r.type, 'AND') AS refineType
    `,
    { goalId: goalRootId }
  )

  return {
    goals,
    relations: relationsRaw.filter(item => item.parentId && item.childId)
  }
}

const getGoalTasks = async (goalId: string) => {
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

const getVisibleGoals = (
  goalRootId: string,
  goals: GoalNode[],
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

export const getThingActions = async (thingId: string) => {
  const thing = await dittoGet<any>(`/things/${thingId}`)
  const goalRootId = inferGoalRootId(thing)

  if (!goalRootId) {
    return {
      thingId,
      goalRootId: null,
      goals: [],
      availableGoals: [],
      tasks: []
    }
  }

  const { goals, relations } = await getGoalTree(goalRootId)
  const visibleGoals = getVisibleGoals(goalRootId, goals, relations)
  const tasksRaw = await getGoalTasks(goalRootId)

  const tasks = tasksRaw.map(task => ({
    taskId: String(task.taskId),
    taskName: String(task.taskName),
    taskCommand: String(task.taskCommand),
    goalId: String(task.goalId),
    goalName: String(task.goalName),
    dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn.map(String).filter(Boolean) : [],
    inputParameters: parseInputParameters(task.inputParameters)
  }))

  return {
    thingId,
    goalRootId,
    goals,
    availableGoals: visibleGoals,
    tasks
  }
}

export const executeThingTask = async (
  thingId: string,
  taskId: string,
  params: Record<string, any> = {}
) => {
  const records = await runNeo4jQuery<{
    taskId: string
    taskName: string
    taskCommand: string
  }>(
    `
    MATCH (t:Task {id: $taskId})
    RETURN
      t.id AS taskId,
      t.name AS taskName,
      t.command AS taskCommand
    `,
    { taskId }
  )

  if (!records.length) {
    throw createError({ statusCode: 404, statusMessage: `Task not found: ${taskId}` })
  }

  const task = records[0]
  const deviceCommand = taskCommandToDeviceCommand[String(task.taskCommand)]

  if (!deviceCommand) {
    throw createError({
      statusCode: 400,
      statusMessage: `No device command mapping for task command ${task.taskCommand}`
    })
  }

  await publishDirectDtCommand(thingId, deviceCommand, params)

  return {
    success: true,
    taskId,
    taskName: task.taskName,
    taskCommand: task.taskCommand,
    deviceCommand,
    params
  }
}

export const executeThingGoal = async (
  thingId: string,
  goalId: string
) => {
  const thing = await dittoGet<any>(`/things/${thingId}`)
  const taskRecords = await getGoalTasks(goalId)

  if (!taskRecords.length) {
    throw createError({ statusCode: 404, statusMessage: `Goal not executable: ${goalId}` })
  }

  const sortedTasks = [...taskRecords].sort((left, right) => {
    return (priorityByTaskCommand[left.taskCommand] ?? 99) - (priorityByTaskCommand[right.taskCommand] ?? 99)
  })

  const executions = []

  for (const task of sortedTasks) {
    const deviceCommand = taskCommandToDeviceCommand[String(task.taskCommand)]

    if (!deviceCommand) {
      continue
    }

    const params = buildParamsFromCurrentThing(task.taskCommand, thing)
    await publishDirectDtCommand(thingId, deviceCommand, params)

    executions.push({
      taskId: task.taskId,
      taskName: task.taskName,
      taskCommand: task.taskCommand,
      deviceCommand,
      params
    })
  }

  return {
    success: true,
    goalId,
    executions
  }
}

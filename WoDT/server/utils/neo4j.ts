import neo4j from 'neo4j-driver'

let driver: neo4j.Driver | null = null

export const getNeo4jConfig = () => {
  const config = useRuntimeConfig()
  const uri = String(config.neo4jUri || '').trim()
  const user = String(config.neo4jUser || '').trim()
  const password = String(config.neo4jPassword || '').trim()

  if (!uri || !user || !password) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing NEO4J_URI, NEO4J_USER or NEO4J_PASSWORD'
    })
  }

  return { uri, user, password }
}

export const getNeo4jDriver = () => {
  if (driver) return driver

  const { uri, user, password } = getNeo4jConfig()
  driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
  return driver
}

export const runNeo4jQuery = async <T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {}
): Promise<T[]> => {
  const session = getNeo4jDriver().session()
  try {
    const result = await session.run(query, params)
    return result.records.map((record) => record.toObject() as T)
  } finally {
    await session.close()
  }
}

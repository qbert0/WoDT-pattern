GET_ALL_CAPABILITIES = """
MATCH (k:Kettle {thingId: $thing_id})-[:HAS_CAPABILITY]->(c:Capability)
RETURN c.name AS name,
       c.description AS description,
       c.ditto_path AS ditto_path,
       c.commands AS commands,
       c.unit AS unit,
       c.range AS range
ORDER BY c.name
"""

GET_CONTROL_CAPABILITIES = """
MATCH (k:Kettle {thingId: $thing_id})-[:HAS_CAPABILITY]->(c:Capability)
WHERE c.commands IS NOT NULL
RETURN c.name AS name,
       c.description AS description,
       c.commands AS commands
ORDER BY c.name
"""

CAN_EXECUTE_COMMAND = """
MATCH (k:Kettle {thingId: $thing_id})-[:HAS_CAPABILITY]->(c:Capability)
WHERE $command IN c.commands
RETURN count(c) > 0 AS can_execute
"""

KETTLE_GRAPH_SEED = """
CREATE (k:Kettle {
  thingId: 'smart-home:kettle-01',
  model: 'RK-18',
  maxCapacity: 1.7,
  maxPower: 2000
});
"""

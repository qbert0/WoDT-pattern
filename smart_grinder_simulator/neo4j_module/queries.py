GET_GOAL_TREE = """
MATCH path = (g:Goal {id: $goal_id})-[:REFINES*0..]->(sub:Goal)
RETURN DISTINCT
  sub.id AS goal_id,
  sub.name AS goal_name,
  sub.description AS description,
  length(path) AS depth
ORDER BY depth, goal_id
"""

GET_GOAL_TASKS = """
MATCH (g:Goal {id: $goal_id})-[:REFINES*0..]->(sub:Goal)-[:OPERATIONALIZED_BY]->(t:Task)
OPTIONAL MATCH (t)-[:DEPENDS_ON]->(dep:Task)
RETURN DISTINCT
  sub.id AS goal_id,
  sub.name AS goal_name,
  t.id AS task_id,
  t.name AS task_name,
  t.command AS task_command,
  t.inputParameters AS input_parameters,
  collect(DISTINCT dep.id) AS depends_on
ORDER BY task_id
"""

CAN_EXECUTE_DT_COMMAND = """
MATCH (g:Goal)-[:REFINES*0..]->(:Goal)-[:OPERATIONALIZED_BY]->(t:Task)
WHERE t.command = $task_command
RETURN count(t) > 0 AS can_execute
"""

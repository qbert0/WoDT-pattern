// Optional additive contract. Apply AFTER the existing WareTwin seeds.
MATCH (allocation:Goal {id: 'G_WT_ALLOC'}), (transport:Goal {id: 'G_WT_TRANSPORT'})
MERGE (task:Task {id: 'T_ORDER_ASSIGN'})
SET task.name = 'AssignTransportOrder',
    task.command = 'ASSIGN_TRANSPORT_ORDER',
    task.executionGoalId = transport.id,
    task.activationCondition = 'Task.status == "WAITING" AND Task.assigned_robot == null',
    task.precondition = 'Task.status == "WAITING" AND Task.assigned_robot == null AND Robot.fsm == "IDLE" AND Robot.status NOT IN ["OFFLINE", "ERROR"] AND Robot.current_task_id == null AND Robot.battery > 20 AND Robot.load.current == 0 AND Task.load_units > 0 AND Task.load_units <= Robot.load.capacity',
    task.postcondition = 'Task.status == "ASSIGNED" AND Task.assigned_robot == Robot.id AND Robot.current_task_id == Task.id',
    task.inputParameters = 'task_id: string, robot_id: string',
    task.outputParameters = 'decision_id: string'
MERGE (allocation)-[:OPERATIONALIZED_BY]->(task);

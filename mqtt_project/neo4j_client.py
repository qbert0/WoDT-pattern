# neo4j_client.py
from neo4j import GraphDatabase
from typing import Dict, Any, List

class KettleCapability:
    """Truy vấn khả năng của ấm từ Knowledge Graph"""
    
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def close(self):
        self.driver.close()
    
    def get_all_capabilities(self, thing_id: str) -> List[Dict[str, Any]]:
        """Lấy TẤT CẢ khả năng của ấm"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (k:Kettle {thingId: $thing_id})-[:HAS_CAPABILITY]->(c:Capability)
                RETURN c.name as name, 
                       c.description as description,
                       c.ditto_path as ditto_path,
                       c.commands as commands,
                       c.unit as unit,
                       c.range as range
            """, thing_id=thing_id)
            return [record.data() for record in result]
    
    def get_sensing_capabilities(self, thing_id: str) -> List[Dict[str, Any]]:
        """Chỉ lấy khả năng CẢM BIẾN (đo lường)"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (k:Kettle {thingId: $thing_id})-[:HAS_CAPABILITY]->(c:Capability)
                WHERE c.name CONTAINS 'sensing' OR c.name CONTAINS 'measurement'
                RETURN c.name as name, 
                       c.ditto_path as ditto_path,
                       c.unit as unit,
                       c.range as range
            """, thing_id=thing_id)
            return [record.data() for record in result]
    
    def get_control_capabilities(self, thing_id: str) -> List[Dict[str, Any]]:
        """Chỉ lấy khả năng ĐIỀU KHIỂN (có thể ra lệnh)"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (k:Kettle {thingId: $thing_id})-[:HAS_CAPABILITY]->(c:Capability)
                WHERE c.commands IS NOT NULL
                RETURN c.name as name,
                       c.description as description,
                       c.commands as commands
            """, thing_id=thing_id)
            return [record.data() for record in result]
    
    def can_execute_command(self, thing_id: str, command: str) -> bool:
        """Kiểm tra xem ấm có hỗ trợ lệnh này không"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (k:Kettle {thingId: $thing_id})-[:HAS_CAPABILITY]->(c:Capability)
                WHERE $command IN c.commands
                RETURN count(c) > 0 as can_execute
            """, thing_id=thing_id, command=command)
            record = result.single()
            return record["can_execute"] if record else False
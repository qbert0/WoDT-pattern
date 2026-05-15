# neo4j_simple.py
from neo4j import GraphDatabase

class KettleKnowledge:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def get_feature_properties(self, thing_id, feature_name):
        """Lấy danh sách properties của một feature"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (k:Kettle {thingId: $thing_id})-[:HAS_FEATURE]->(f:Feature {name: $feature})
                MATCH (f)-[:HAS_PROPERTY]->(p:Property)
                RETURN p.name as name, p.type as type, p.unit as unit, p.range as range
            """, thing_id=thing_id, feature=feature_name)
            return [record.data() for record in result]
    
    def get_all_features(self, thing_id):
        """Lấy tất cả feature của ấm"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (k:Kettle {thingId: $thing_id})-[:HAS_FEATURE]->(f:Feature)
                RETURN f.name as name, f.description as description
            """, thing_id=thing_id)
            return [record.data() for record in result]

# Sử dụng
kg = KettleKnowledge("bolt://100.104.220.45:7687", "neo4j", "password123")
print(kg.get_feature_properties("smart-home:kettle-01", "water"))
# Output: [
#   {'name': 'temperature', 'type': 'number', 'unit': 'celsius', 'range': [25, 100]},
#   {'name': 'waterLevel', 'type': 'number', 'unit': 'percent', 'range': [0, 100]},
#   {'name': 'targetTemperature', 'type': 'number', 'unit': 'celsius', 'range': [70, 100]}
# ]
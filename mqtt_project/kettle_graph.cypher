// =====================================================
// KETTLE CAPABILITY GRAPH - Khả năng của ấm
// =====================================================

// 1. Tạo node ấm
CREATE (k:Kettle {
  thingId: 'smart-home:kettle-01',
  model: 'RK-18',
  maxCapacity: 1.7,
  maxPower: 2000
});

// 2. Tạo capabilities (khả năng)
CREATE (c1:Capability {name: 'power_control', description: 'Bật/tắt nguồn'})
CREATE (c2:Capability {name: 'temperature_sensing', description: 'Đo nhiệt độ'})
CREATE (c3:Capability {name: 'water_level_sensing', description: 'Đo mực nước'})
CREATE (c4:Capability {name: 'power_measurement', description: 'Đo công suất'})
CREATE (c5:Capability {name: 'temperature_control', description: 'Đặt nhiệt độ mục tiêu'});

// 3. Liên kết capabilities với properties tương ứng
MATCH (k:Kettle {thingId: 'smart-home:kettle-01'})
MATCH (c1:Capability {name: 'power_control'})
MATCH (c2:Capability {name: 'temperature_sensing'})
MATCH (c3:Capability {name: 'water_level_sensing'})
MATCH (c4:Capability {name: 'power_measurement'})
MATCH (c5:Capability {name: 'temperature_control'})

CREATE (k)-[:HAS_CAPABILITY]->(c1)
CREATE (k)-[:HAS_CAPABILITY]->(c2)
CREATE (k)-[:HAS_CAPABILITY]->(c3)
CREATE (k)-[:HAS_CAPABILITY]->(c4)
CREATE (k)-[:HAS_CAPABILITY]->(c5)

// Gắn thêm thông tin property tương ứng trong Ditto
SET c1.ditto_path = '/features/power/properties/status',
    c1.commands = ['turn_on', 'turn_off'];

SET c2.ditto_path = '/features/water/properties/temperature',
    c2.unit = 'celsius',
    c2.range = [25, 100];

SET c3.ditto_path = '/features/water/properties/waterLevel',
    c3.unit = 'percent',
    c3.range = [0, 100];

SET c4.ditto_path = '/features/power/properties/powerConsumption',
    c4.unit = 'watt',
    c4.range = [0, 2000];

SET c5.ditto_path = '/features/water/properties/targetTemperature',
    c5.commands = ['set_target_temperature'],
    c5.unit = 'celsius',
    c5.range = [70, 100];

RETURN k, c1, c2, c3, c4, c5;
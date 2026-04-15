// =========================
// INTEGRATION RELATIONS
// =========================

// HotWaterAvailable phụ thuộc vào goal root của Kettle
MATCH (gs11:Goal {id: 'G_S1_1'})
MATCH (gk_1:Goal {id: 'G_K1'})
MERGE (gs11)-[r1:DEPENDS_ON]->(gk_1)
SET r1.type = 'ACHIEVED',
    r1.description = 'Nước nóng chỉ sẵn sàng khi kettle đạt được mục tiêu cung cấp nước nóng';

// GroundCoffeeAvailable phụ thuộc vào goal root của Grinder
MATCH (gs12:Goal {id: 'G_S1_2'})
MATCH (gr_root:Goal {id: 'G_GRINDER_ROOT'})
MERGE (gs12)-[r2:DEPENDS_ON]->(gr_root)
SET r2.type = 'ACHIEVED',
    r2.description = 'Cà phê xay chỉ sẵn sàng khi grinder đạt được mục tiêu cung cấp cà phê xay';

// SetBeanAmount phụ thuộc vào SetWaterVolume
MATCH (tg2:Task {id: 'T_G2'})
MATCH (tk4:Task {id: 'T_K4'})
MERGE (tk4)-[r3:DEPENDS_ON]->(tg2)
SET r3.type = 'PARAMETER',
    r3.sourceParameter = 'amount',
    r3.targetParameter = 'volume',
    r3.factor = 5.0,
    r3.offset = 0.0,
    r3.description = 'Luong nuoc can thiet phu thuoc vao luong hat ca phe de dam bao dung ti le pha';

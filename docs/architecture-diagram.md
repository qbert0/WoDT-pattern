# Kiến trúc Hệ thống WoDT (Web of Digital Twins)

```mermaid
---
title: WoDT System Architecture – Tổng quan luồng dữ liệu & kết nối
---
flowchart TB
    subgraph Client ["🧑‍💻 Client Layer"]
        direction LR
        React["React App (Ditto Studio)\nPort 5173\nVite + React 18"]
        Nuxt["WoDT Dashboard\nPort 3000\nNuxt 4 (SSR + API)"]
    end

    subgraph Ambassador ["🔐 Ambassador Layer"]
        Amb["Ditto Ambassador\nPort 8081\nSpring Boot Gateway"]
    end

    subgraph Ditto ["☁️ Digital Twin Platform"]
        direction TB
        DittoNginx["NGINX\nPort 8080"]
        DittoGw["Ditto Gateway\nPort 8082"]
        DittoSvc["Ditto Services\n• Things\n• Policies\n• Search\n• Connectivity"]
        MongoDB[("MongoDB\nDitto Backing Store")]
        DittoNginx --> DittoGw --> DittoSvc
        DittoSvc --- MongoDB
    end

    subgraph Messaging ["📨 Messaging Layer"]
        MQTT["Mosquitto MQTT Broker\nPort 1883"]
    end

    subgraph Simulators ["⚙️ Simulator Layer"]
        direction LR
        Kettle["Kettle Simulator\nThing: smart-home:kettle-01\nGoal: G_KETTLE_ROOT"]
        Grinder["Grinder Simulator\nThing: smart-home:grinder-01\nGoal: G_GRINDER_ROOT"]
    end

    subgraph Knowledge ["🧠 Knowledge Graph"]
        Neo4j[("Neo4j Database\nPort 7687 (Bolt)\nPort 7474 (Browser)")]
    end

    subgraph DTApps ["🔄 Digital Twin Apps"]
        KettleDT["Kettle DT App\n• MQTT Device Bridge\n• Ditto Protocol Bridge"]
        GrinderDT["Grinder DT App\n• MQTT Device Bridge\n• Ditto Protocol Bridge"]
    end

    %% == Connections ==

    %% Client → Ambassador
    React -- "HTTP REST\n/api/2/**\n/api/digital-twins/*" --> Amb
    Nuxt -- "HTTP REST\n/api/2/**\n/api/digital-twins/*" --> Amb

    %% Client → Neo4j (direct)
    React -- "Bolt Protocol (neo4j-driver)\nRead goals/tasks" --> Neo4j

    %% Ambassador → Ditto
    Amb -- "HTTP (proxy)\n/api/2/things\n/api/2/search\n/api/2/policies" --> DittoNginx

    %% Nuxt → Ditto
    Nuxt -- "HTTP REST\n/api/ditto/*\nSSE stream" --> DittoNginx

    %% Nuxt → MQTT
    Nuxt -- "MQTT Publish\ncommands via\nditto/things/{id}/inbox" --> MQTT

    %% Nuxt → Neo4j
    Nuxt -- "Bolt Protocol\nGoal/Task CRUD" --> Neo4j

    %% MQTT → DT Apps
    MQTT -- "Subscribe:\n{ns}/{name}/things/live/messages/+" --> KettleDT
    MQTT -- "Subscribe:\nkettle/{thingId}/state" --> KettleDT
    MQTT -- "Subscribe:\n{ns}/{name}/things/live/messages/+" --> GrinderDT
    MQTT -- "Subscribe:\ngrinder/{thingId}/state" --> GrinderDT

    %% DT Apps ↔ Simulators (via MQTT)
    MQTT -- "kettle/{thingId}/commands" --> Kettle
    Kettle -- "kettle/{thingId}/state" --> MQTT
    MQTT -- "grinder/{thingId}/commands" --> Grinder
    Grinder -- "grinder/{thingId}/state" --> MQTT

    %% DT Apps → Ditto (via MQTT Ditto Protocol)
    KettleDT -- "Publish twin commands\n{ns}/{name}/things/twin/commands/modify" --> MQTT
    GrinderDT -- "Publish twin commands\n{ns}/{name}/things/twin/commands/modify" --> MQTT

    %% Ditto → DT Apps (via MQTT Connection)
    DittoSvc -. "Ditto MQTT Connection\n(live messages)" .-> MQTT

    %% Neo4j → Ditto (via Ambassador, indirect reference)
    Neo4j -. "Agent nodes reference\nthingId & goalAgentId" .-> Amb

    %% == Styling ==
    classDef client fill:#e1f5fe,stroke:#0288d1,color:#000
    classDef ambassador fill:#fff3e0,stroke:#f57c00,color:#000
    classDef ditto fill:#e8f5e9,stroke:#388e3c,color:#000
    classDef mqtt fill:#fce4ec,stroke:#c62828,color:#000
    classDef simulator fill:#f3e5f5,stroke:#7b1fa2,color:#000
    classDef dtapp fill:#ede7f6,stroke:#4527a0,color:#000
    classDef neo4j fill:#fff8e1,stroke:#f9a825,color:#000

    class React,Nuxt client
    class Amb ambassador
    class DittoNginx,DittoGw,DittoSvc,MongoDB ditto
    class MQTT mqtt
    class Kettle,Grinder simulator
    class KettleDT,GrinderDT dtapp
    class Neo4j neo4j
```

## Chú thích luồng dữ liệu chính

### 1. Luồng tạo Digital Twin
```
React App → PUT /api/digital-twins/{thingId} (Ambassador)
         → Kiểm tra goalAgentId uniqueness (Ditto Search)
         → PUT /api/2/things/{thingId} (Ditto)
         → Tạo Agent node trong Neo4j
```

### 2. Luồng gửi lệnh (qua WoDT)
```
Nuxt Dashboard → POST /api/digital-twin/things/{id}/tasks/{taskId}/execute
              → Tra cứu task trong Neo4j → map device command
              → Publish MQTT tới ditto/things/{thingId}/inbox/messages/direct-web
              → Ditto forward live message → DT App nhận được
              → DT App publish tới kettle/grinder/{thingId}/commands
              → Simulator xử lý → publish state ngược lại
```

### 3. Luồng cập nhật trạng thái real-time
```
Simulator → publish state → MQTT (kettle/{thingId}/state)
         → DT App (subscribed) nhận state
         → DT App publish lên Ditto qua twin commands
         → Ditto cập nhật twin state
         → Nuxt SSE stream / client polling đọc được
```

### 4. Luồng Orchestration (System Goal - MakeCoffee)
```
Nuxt → GET /api/system/actions → đọc goal tree từ Neo4j
     → Giải quyết dependency giữa các goals (HotWaterAvailable → G_K1)
     → Map goals → things (DELEGATED_TO)
     → Giải quyết parameter dependency (beanAmount → waterVolume * 5.0)
     → Thực thi tasks theo thứ tự ưu tiên
```

## Bảng cổng kết nối

| Cổng    | Service               | Giao thức |
|---------|-----------------------|-----------|
| 8080    | Eclipse Ditto (HTTP)  | REST/HTTP |
| 8081    | Ditto Ambassador      | REST/HTTP |
| 1883    | Mosquitto MQTT        | MQTT      |
| 5173    | React App (Vite)      | HTTP      |
| 3000    | WoDT Nuxt App         | HTTP      |
| 7687    | Neo4j Bolt            | Bolt      |
| 7474    | Neo4j Browser         | HTTP      |
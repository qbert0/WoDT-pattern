# WoDT-pattern - Run Commands

## Quick Start

### Run All Services (PowerShell)

```powershell
.\run-all.ps1
```

Or run specific service groups:

```powershell
.\run-all.ps1 all          # All services
.\run-all.ps1 frontend     # Nuxt + React
.\run-all.ps1 backend      # Neo4j + Ditto + MQTT
.\run-all.ps1 simulators   # Grinder + Kettle
```

Or run individual services:

```powershell
.\run-all.ps1 neo4j
.\run-all.ps1 ditto
.\run-all.ps1 mqtt
.\run-all.ps1 grinder
.\run-all.ps1 kettle
.\run-all.ps1 nuxt
.\run-all.ps1 react
```

---

## Manual Commands by Component

### 1. Database - Neo4j

```bash
cd smart_kettle_simulator
docker-compose up
# Access: http://localhost:7687 (bolt)
# Web UI: http://localhost:7474 (username: neo4j, password: neo4j)
```

### 2. Backend - Ditto Ambassador (Spring Boot)

```bash
cd ditto-ambassador
mvn spring-boot:run
# or
mvn clean install
java -jar target/ditto-ambassador-0.0.1-SNAPSHOT.jar
# Access: http://localhost:8080
```

### 3. MQTT Bridge

```bash
cd mqtt_project
pip install -r requirements.txt
python main.py
```

### 4. Grinder Simulator

```bash
cd smart_grinder_simulator
pip install -r requirements.txt
python main.py
# Or run scripts individually:
python scripts/run_simulation.py
python scripts/run_digital_twin.py
python scripts/seed_neo4j.py
```

### 5. Kettle Simulator

```bash
cd smart_kettle_simulator
pip install -r requirements.txt
python main.py
# Or run scripts individually:
python scripts/run_simulation.py
python scripts/run_digital_twin.py
python scripts/seed_neo4j.py
```

### 6. Frontend - Nuxt (Vue)

```bash
cd WoDT
npm install
npm run dev
# Access: http://localhost:3000
```

### 7. Frontend - React + Vite

```bash
cd client-aplication
npm install
npm run dev
# Access: http://localhost:5173
```

---

## Complete System Setup (7 terminals)

```powershell
# Terminal 1: Database
cd smart_kettle_simulator
docker-compose up

# Terminal 2: Backend Gateway
cd ditto-ambassador
mvn spring-boot:run

# Terminal 3: MQTT Bridge
cd mqtt_project
python main.py

# Terminal 4: Grinder Simulator
cd smart_grinder_simulator
python main.py

# Terminal 5: Kettle Simulator
cd smart_kettle_simulator
python main.py

# Terminal 6: Nuxt Frontend
cd WoDT
npm run dev

# Terminal 7: React Client (Optional)
cd client-aplication
npm run dev
```

---

## Dependencies Installation

### Node.js dependencies (Frontend)

```bash
cd WoDT
npm install

cd client-aplication
npm install
```

### Python dependencies (Simulators & MQTT)

```bash
cd mqtt_project
pip install -r requirements.txt

cd smart_grinder_simulator
pip install -r requirements.txt

cd smart_kettle_simulator
pip install -r requirements.txt
```

### Java/Maven (Backend)

```bash
cd ditto-ambassador
mvn clean install
```

---

## Service Ports

| Service          | Port | URL                   |
| ---------------- | ---- | --------------------- |
| Neo4j Bolt       | 7687 | bolt://localhost:7687 |
| Neo4j Web UI     | 7474 | http://localhost:7474 |
| Ditto Ambassador | 8080 | http://localhost:8080 |
| Nuxt Frontend    | 3000 | http://localhost:3000 |
| React Client     | 5173 | http://localhost:5173 |
| MQTT Broker      | 1883 | mqtt://localhost:1883 |

---

## Troubleshooting

### Python Virtual Environment

If using venv, activate first:

```powershell
.\.venv\Scripts\Activate.ps1
```

### Port Already in Use

Kill process using port:

```powershell
# Windows
netstat -ano | findstr :PORT
taskkill /PID <PID> /F

# Or use
Get-Process -Id (Get-NetTCPConnection -LocalPort PORT).OwningProcess | Stop-Process
```

### Clear Node Modules Cache

```bash
npm cache clean --force
rm -r node_modules
npm install
```

### Rebuild Maven

```bash
cd ditto-ambassador
mvn clean install -U
```

---

## Development Tips

- Run `npm run build` to create production builds
- Run `mvn -DskipTests=true` to skip tests during build
- Use `npm run lint` to check code quality
- Check Neo4j browser at http://localhost:7474 for database visualization

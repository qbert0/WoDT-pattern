# Run all WoDT-pattern services
# Usage: .\run-all.ps1 [service] [option]
# Examples:
#   .\run-all.ps1                    # Show menu
#   .\run-all.ps1 all               # Run all services
#   .\run-all.ps1 frontend          # Run only frontend services
#   .\run-all.ps1 backend           # Run only backend services
#   .\run-all.ps1 simulators        # Run only simulators

param(
    [string]$Service = "",
    [string]$Option = ""
)

$ErrorActionPreference = "SilentlyContinue"

function Show-Menu {
    Write-Host "`n=== WoDT-pattern Services ===" -ForegroundColor Cyan
    Write-Host "1. Run ALL services" -ForegroundColor Green
    Write-Host "2. Run Frontend only (Nuxt + React)" -ForegroundColor Yellow
    Write-Host "3. Run Backend (Ditto Ambassador + MQTT)" -ForegroundColor Yellow
    Write-Host "4. Run Simulators (Grinder + Kettle)" -ForegroundColor Yellow
    Write-Host "5. Run Individual Service" -ForegroundColor Yellow
    Write-Host "6. Run Database (Neo4j)" -ForegroundColor Yellow
    Write-Host "0. Exit" -ForegroundColor Red
    Write-Host ""
}

function Start-Service {
    param([string]$Name, [string]$Path, [string]$Command)
    
    Write-Host "`n>>> Starting $Name..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Path'; $Command" -WindowStyle Normal
    Start-Sleep -Seconds 2
}

function Run-AllServices {
    Write-Host "`nStarting ALL services..." -ForegroundColor Cyan
    
    # Neo4j
    Start-Service "Neo4j" "e:\WoDT-pattern\smart_kettle_simulator" "docker-compose up"
    
    # Ditto Ambassador
    Start-Service "Ditto Ambassador" "e:\WoDT-pattern\ditto-ambassador" "mvn spring-boot:run"
    
    # MQTT Project
    Start-Service "MQTT Bridge" "e:\WoDT-pattern\mqtt_project" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py"
    
    # Grinder Simulator
    Start-Service "Grinder Simulator" "e:\WoDT-pattern\smart_grinder_simulator" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py"
    
    # Kettle Simulator
    Start-Service "Kettle Simulator" "e:\WoDT-pattern\smart_kettle_simulator" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py"
    
    # Nuxt Frontend
    Start-Service "Nuxt Frontend" "e:\WoDT-pattern\WoDT" "npm run dev"
    
    # React Client
    Start-Service "React Client (optional)" "e:\WoDT-pattern\client-aplication" "npm run dev"
    
    Write-Host "`n✓ All services started!" -ForegroundColor Green
    Write-Host "  - Neo4j: http://localhost:7687 (bolt)" -ForegroundColor Gray
    Write-Host "  - Ditto Ambassador: http://localhost:8080" -ForegroundColor Gray
    Write-Host "  - Nuxt Frontend: http://localhost:3000" -ForegroundColor Gray
    Write-Host "  - React Client: http://localhost:5173" -ForegroundColor Gray
}

function Run-Frontend {
    Write-Host "`nStarting Frontend services..." -ForegroundColor Cyan
    Start-Service "Nuxt Frontend" "e:\WoDT-pattern\WoDT" "npm run dev"
    Start-Service "React Client (optional)" "e:\WoDT-pattern\client-aplication" "npm run dev"
    Write-Host "`n✓ Frontend services started!" -ForegroundColor Green
}

function Run-Backend {
    Write-Host "`nStarting Backend services..." -ForegroundColor Cyan
    Start-Service "Neo4j" "e:\WoDT-pattern\smart_kettle_simulator" "docker-compose up"
    Start-Service "Ditto Ambassador" "e:\WoDT-pattern\ditto-ambassador" "mvn spring-boot:run"
    Start-Service "MQTT Bridge" "e:\WoDT-pattern\mqtt_project" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py"
    Write-Host "`n✓ Backend services started!" -ForegroundColor Green
}

function Run-Simulators {
    Write-Host "`nStarting Simulators..." -ForegroundColor Cyan
    Start-Service "Grinder Simulator" "e:\WoDT-pattern\smart_grinder_simulator" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py"
    Start-Service "Kettle Simulator" "e:\WoDT-pattern\smart_kettle_simulator" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py"
    Write-Host "`n✓ Simulators started!" -ForegroundColor Green
}

function Show-Services {
    Write-Host "`n=== Available Services ===" -ForegroundColor Cyan
    Write-Host "1. Neo4j Database" -ForegroundColor Yellow
    Write-Host "2. Ditto Ambassador" -ForegroundColor Yellow
    Write-Host "3. MQTT Bridge" -ForegroundColor Yellow
    Write-Host "4. Grinder Simulator" -ForegroundColor Yellow
    Write-Host "5. Kettle Simulator" -ForegroundColor Yellow
    Write-Host "6. Nuxt Frontend" -ForegroundColor Yellow
    Write-Host "7. React Client" -ForegroundColor Yellow
    Write-Host "0. Back to main menu" -ForegroundColor Red
    Write-Host ""
}

function Run-IndividualService {
    do {
        Show-Services
        $choice = Read-Host "Select service (0-7)"
        
        switch ($choice) {
            "1" { Start-Service "Neo4j" "e:\WoDT-pattern\smart_kettle_simulator" "docker-compose up"; break }
            "2" { Start-Service "Ditto Ambassador" "e:\WoDT-pattern\ditto-ambassador" "mvn spring-boot:run"; break }
            "3" { Start-Service "MQTT Bridge" "e:\WoDT-pattern\mqtt_project" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py"; break }
            "4" { Start-Service "Grinder Simulator" "e:\WoDT-pattern\smart_grinder_simulator" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py"; break }
            "5" { Start-Service "Kettle Simulator" "e:\WoDT-pattern\smart_kettle_simulator" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py"; break }
            "6" { Start-Service "Nuxt Frontend" "e:\WoDT-pattern\WoDT" "npm run dev"; break }
            "7" { Start-Service "React Client" "e:\WoDT-pattern\client-aplication" "npm run dev"; break }
            "0" { return }
            default { Write-Host "Invalid choice" -ForegroundColor Red }
        }
    } while ($true)
}

# Handle command line arguments
if ($Service -eq "") {
    do {
        Show-Menu
        $choice = Read-Host "Select option (0-6)"
        
        switch ($choice) {
            "1" { Run-AllServices; break }
            "2" { Run-Frontend; break }
            "3" { Run-Backend; break }
            "4" { Run-Simulators; break }
            "5" { Run-IndividualService }
            "6" { Start-Service "Neo4j" "e:\WoDT-pattern\smart_kettle_simulator" "docker-compose up"; break }
            "0" { Write-Host "Goodbye!" -ForegroundColor Green; exit }
            default { Write-Host "Invalid choice" -ForegroundColor Red }
        }
    } while ($true)
} else {
    switch ($Service.ToLower()) {
        "all" { Run-AllServices }
        "frontend" { Run-Frontend }
        "backend" { Run-Backend }
        "simulators" { Run-Simulators }
        "neo4j" { Start-Service "Neo4j" "e:\WoDT-pattern\smart_kettle_simulator" "docker-compose up" }
        "ditto" { Start-Service "Ditto Ambassador" "e:\WoDT-pattern\ditto-ambassador" "mvn spring-boot:run" }
        "mqtt" { Start-Service "MQTT Bridge" "e:\WoDT-pattern\mqtt_project" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py" }
        "grinder" { Start-Service "Grinder Simulator" "e:\WoDT-pattern\smart_grinder_simulator" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py" }
        "kettle" { Start-Service "Kettle Simulator" "e:\WoDT-pattern\smart_kettle_simulator" ". `$env:VIRTUAL_ENV\Scripts\Activate.ps1; python main.py" }
        "nuxt" { Start-Service "Nuxt Frontend" "e:\WoDT-pattern\WoDT" "npm run dev" }
        "react" { Start-Service "React Client" "e:\WoDT-pattern\client-aplication" "npm run dev" }
        default { Write-Host "Unknown service: $Service"; Write-Host "Available: all, frontend, backend, simulators, neo4j, ditto, mqtt, grinder, kettle, nuxt, react" }
    }
}

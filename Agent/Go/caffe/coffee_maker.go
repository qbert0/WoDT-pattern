package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "sync"
    "time"
)

type CoffeeMaker struct {
    DeviceID          string    `json:"device_id"`
    Name              string    `json:"name"`
    DeviceType        string    `json:"device_type"`
    Status            string    `json:"status"` // idle, brewing, stopped
    WaterLevel        float64   `json:"water_level"` // lít
    CoffeeBeansLevel  float64   `json:"coffee_beans_level"` // kg
    Temperature       float64   `json:"temperature"`
    PowerConsumption  int       `json:"power_consumption"`
    LastUpdate        time.Time `json:"last_update"`
    mu                sync.Mutex
}

type ControlCommand struct {
    Command  string `json:"command"`
    Strength string `json:"strength,omitempty"`
}

var coffeeMaker = CoffeeMaker{
    DeviceID:         "GO_COFFEE_001",
    Name:             "Máy pha cà phê thông minh (Go)",
    DeviceType:       "COFFEE_MAKER",
    Status:           "idle",
    WaterLevel:       1.5,
    CoffeeBeansLevel: 0.5,
    Temperature:      25.0,
    PowerConsumption: 0,
    LastUpdate:       time.Now(),
}

func main() {
    // CORS middleware
    corsMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
        return func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Access-Control-Allow-Origin", "*")
            w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
            if r.Method == "OPTIONS" {
                w.WriteHeader(http.StatusOK)
                return
            }
            next(w, r)
        }
    }

    // API endpoints
    http.HandleFunc("/api/status", corsMiddleware(handleStatus))
    http.HandleFunc("/api/control", corsMiddleware(handleControl))

    fmt.Println("=" + strings.Repeat("=", 59))
    fmt.Println("☕ DIGITAL TWIN - MÁY PHA CÀ PHÊ (Go)")
    fmt.Println("=" + strings.Repeat("=", 59))
    fmt.Println("📍 Server đang chạy tại: http://localhost:3003")
    fmt.Println("📡 Đang chờ kết nối từ Energy Manager...")
    fmt.Println("=" + strings.Repeat("=", 60))

    log.Fatal(http.ListenAndServe(":3003", nil))
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
    coffeeMaker.mu.Lock()
    defer coffeeMaker.mu.Unlock()

    response := map[string]interface{}{
        "device_id":         coffeeMaker.DeviceID,
        "device_type":       coffeeMaker.DeviceType,
        "name":              coffeeMaker.Name,
        "status":            coffeeMaker.Status,
        "power_consumption": coffeeMaker.PowerConsumption,
        "water_level":       coffeeMaker.WaterLevel,
        "coffee_beans":      coffeeMaker.CoffeeBeansLevel,
        "temperature":       coffeeMaker.Temperature,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func handleControl(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var command ControlCommand
    if err := json.NewDecoder(r.Body).Decode(&command); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    coffeeMaker.mu.Lock()
    defer coffeeMaker.mu.Unlock()

    switch command.Command {
    case "brew":
        if coffeeMaker.WaterLevel < 0.3 {
            sendResponse(w, false, "Không đủ nước để pha cà phê!")
            return
        }
        if coffeeMaker.CoffeeBeansLevel < 0.1 {
            sendResponse(w, false, "Không đủ cà phê để pha!")
            return
        }
        
        coffeeMaker.Status = "brewing"
        coffeeMaker.PowerConsumption = 1200
        
        // Goroutine để mô phỏng quá trình pha
        go func() {
            time.Sleep(120 * time.Second) // 2 phút
            coffeeMaker.mu.Lock()
            coffeeMaker.Status = "idle"
            coffeeMaker.PowerConsumption = 0
            coffeeMaker.WaterLevel -= 0.3
            coffeeMaker.CoffeeBeansLevel -= 0.1
            coffeeMaker.Temperature += 15
            coffeeMaker.mu.Unlock()
            fmt.Println("✅ Cà phê đã pha xong!")
        }()
        
        sendResponse(w, true, "Đang pha cà phê...")
        
    case "stop":
        coffeeMaker.Status = "stopped"
        coffeeMaker.PowerConsumption = 0
        sendResponse(w, true, "Đã dừng pha cà phê")
        
    case "fill_water":
        coffeeMaker.WaterLevel = 1.5
        sendResponse(w, true, "Đã thêm nước vào máy")
        
    case "add_beans":
        coffeeMaker.CoffeeBeansLevel = 0.5
        sendResponse(w, true, "Đã thêm cà phê vào máy")
        
    default:
        sendResponse(w, false, "Lệnh không hợp lệ")
    }
}

func sendResponse(w http.ResponseWriter, success bool, message string) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "success": success,
        "message": message,
    })
}

// Helper function để dùng strings.Repeat
func strings() *stringsHelper {
    return &stringsHelper{}
}

type stringsHelper struct{}

func (s *stringsHelper) Repeat(str string, count int) string {
    result := ""
    for i := 0; i < count; i++ {
        result += str
    }
    return result
}
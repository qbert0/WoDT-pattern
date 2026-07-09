# Ditto Ambassador

Spring Boot service đứng giữa `client-aplication` và Eclipse Ditto. Service giữ Ditto credentials ở backend, proxy các API Ditto và cung cấp một API create-only để không ghi đè Digital Twin đã tồn tại.

## API

- `PUT /api/digital-twins/{thingId}`: tạo Thing mới. Payload giống body của `PUT /api/2/things/{thingId}` trong Ditto.
- `/api/2/**`: proxy trong suốt tới Ditto.
- `GET /actuator/health`: trạng thái service.

API tạo sử dụng `If-None-Match: *`. Nếu `thingId` đã tồn tại, response là:

```json
{
  "code": "DIGITAL_TWIN_ALREADY_EXISTS",
  "message": "Digital Twin with thingId 'org.example:machine-1' already exists.",
  "thingId": "org.example:machine-1"
}
```

với HTTP status `409 Conflict`.

## Chạy local

Yêu cầu Java 21 và Maven 3.6.3 trở lên.

```bash
cp .env.example .env
# Cập nhật Ditto URL và credentials trong .env
set -a
source .env
set +a
mvn spring-boot:run
```

Ambassador mặc định chạy tại `http://localhost:8081`.

## Docker Compose

```bash
cp .env.example .env
# Cập nhật .env trước khi chạy
docker compose up --build -d
docker compose ps
```

Để dừng service:

```bash
docker compose down
```

Không đưa `.env` vào image hoặc Git. Ambassador hiện không xác thực request đầu vào, vì vậy chỉ nên publish trong mạng tin cậy hoặc sau firewall/reverse proxy.

## Cấu hình

| Biến | Ý nghĩa | Mặc định |
| --- | --- | --- |
| `DITTO_BASE_URL` | Origin của Ditto, không gồm `/api/2` | bắt buộc |
| `DITTO_USERNAME`, `DITTO_PASSWORD` | Basic Auth cho Things, Policies, Search | bắt buộc |
| `DITTO_DEVOPS_USERNAME`, `DITTO_DEVOPS_PASSWORD` | Basic Auth cho Connections | bắt buộc |
| `CORS_ALLOWED_ORIGINS` | Origin được phép gọi ambassador | `http://localhost:5173` |
| `DITTO_CONNECT_TIMEOUT` | Connect timeout của create API | `5s` |
| `DITTO_CONNECT_TIMEOUT_MS` | Connect timeout của gateway proxy | `5000` |
| `DITTO_RESPONSE_TIMEOUT` | Response timeout | `30s` |

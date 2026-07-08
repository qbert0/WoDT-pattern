# Client Application (Ditto Studio)

Đây là ứng dụng giao diện người dùng (Frontend) được xây dựng bằng **React** và **Vite** cho dự án Digital Twin (WoDT-pattern).

## 🛠 Yêu cầu hệ thống

- **Node.js**: Phiên bản 16.x hoặc mới hơn (khuyên dùng bản LTS mới nhất).
- **npm**: Đi kèm khi cài đặt Node.js.

## 🚀 Hướng dẫn cài đặt và chạy ứng dụng

### 1. Di chuyển vào thư mục dự án

Mở Terminal (hoặc Command Prompt, PowerShell) và di chuyển vào thư mục chứa mã nguồn client:

```bash
cd e:\WoDT-pattern\client-aplication
```

### 2. Cài đặt các thư viện phụ thuộc (Dependencies)

Chạy lệnh sau để tải và cài đặt các packages cần thiết đã được định nghĩa trong `package.json`:

```bash
npm install
```

### 3. Cấu hình môi trường

Tạo file `.env` từ file mẫu, sau đó cập nhật địa chỉ và thông tin kết nối theo môi trường của bạn:

```bash
cp .env.example .env
```

Các nhóm cấu hình chính:

- `VITE_DITTO_*`: API URL, tài khoản Ditto/devops, polling và phân trang.
- `VITE_NEO4J_*`: URI, tài khoản Neo4j, URL ứng dụng graph và giới hạn truy vấn.

Sau khi sửa `.env`, cần khởi động lại Vite để nạp cấu hình mới.

### 4. Khởi chạy server phát triển (Development Server)

Sau khi quá trình cài đặt hoàn tất, hãy khởi động ứng dụng bằng lệnh:

```bash
npm run dev
```

### 5. Truy cập ứng dụng trên trình duyệt

Ứng dụng sẽ tự động chạy tại một cổng mặc định (thường là 5173). Mở trình duyệt web của bạn và truy cập vào:

👉 **http://localhost:5173**

*(Nếu cổng 5173 đã bị chiếm dụng, Vite sẽ tự động cấp một cổng khác, bạn hãy xem kỹ thông báo trong Terminal).*

---

## 📜 Các lệnh hỗ trợ khác (Scripts)

- **`npm run build`**: Đóng gói ứng dụng để sẵn sàng triển khai lên môi trường thực tế (Production). Code sẽ được tối ưu hóa và đưa vào thư mục `dist`.
- **`npm run preview`**: Chạy thử bản build ở local để kiểm tra trước khi deploy.
- **`npm run lint`**: Kiểm tra lỗi cú pháp và tiêu chuẩn code bằng ESLint.

## ⚠️ Lưu ý quan trọng về Cấu hình (Configuration)

- Không commit file `.env`; repository chỉ lưu `.env.example` làm mẫu.
- Các biến có tiền tố `VITE_` được đóng gói vào mã frontend và người dùng trình duyệt có thể đọc được. `.env` giúp quản lý cấu hình, nhưng không bảo mật secret. Khi triển khai production, nên đưa thao tác Neo4j và xác thực nhạy cảm qua backend/proxy.
- Đảm bảo máy tính của bạn có kết nối Internet để ứng dụng có thể giao tiếp với database Neo4j.

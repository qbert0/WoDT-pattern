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
*(Thay đổi đường dẫn nếu bạn đang mở thư mục ở vị trí khác)*

### 2. Cài đặt các thư viện phụ thuộc (Dependencies)

Chạy lệnh sau để tải và cài đặt các packages cần thiết đã được định nghĩa trong `package.json`:

```bash
npm install
```

### 3. Khởi chạy server phát triển (Development Server)

Sau khi quá trình cài đặt hoàn tất, hãy khởi động ứng dụng bằng lệnh:

```bash
npm run dev
```

### 4. Truy cập ứng dụng trên trình duyệt

Ứng dụng sẽ tự động chạy tại một cổng mặc định (thường là 5173). Mở trình duyệt web của bạn và truy cập vào:

👉 **http://localhost:5173**

*(Nếu cổng 5173 đã bị chiếm dụng, Vite sẽ tự động cấp một cổng khác, bạn hãy xem kỹ thông báo trong Terminal).*

---

## 📜 Các lệnh hỗ trợ khác (Scripts)

- **`npm run build`**: Đóng gói ứng dụng để sẵn sàng triển khai lên môi trường thực tế (Production). Code sẽ được tối ưu hóa và đưa vào thư mục `dist`.
- **`npm run preview`**: Chạy thử bản build ở local để kiểm tra trước khi deploy.
- **`npm run lint`**: Kiểm tra lỗi cú pháp và tiêu chuẩn code bằng ESLint.

## ⚠️ Lưu ý quan trọng về Cấu hình (Configuration)

- Ứng dụng hiện đang được tích hợp trực tiếp với cơ sở dữ liệu **Neo4j** (AuraDB). Các thông tin xác thực (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`) đang được cấu hình trực tiếp trong các file component (ví dụ: `src/components/TargetGraphSetup.jsx`). 
- Đảm bảo máy tính của bạn có kết nối Internet để ứng dụng có thể giao tiếp với database Neo4j.

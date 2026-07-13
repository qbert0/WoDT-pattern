# Digital Twin thành phần và Goal Root ID

Tài liệu này mô tả phần mở rộng kỹ thuật tại Bước 2 của quy trình tạo Digital Twin trong `client-aplication`.

## Mục tiêu và cấu trúc dữ liệu

Mỗi Digital Twin mới phải có một `attributes.goalRootId` chưa được DT nào khác sử dụng. DT mới có thể tham chiếu không, một hoặc nhiều DT hiện có thông qua feature `components`:

```json
{
  "attributes": {
    "goalRootId": "G_GRINDER_ROOT"
  },
  "features": {
    "components": {
      "properties": {
        "thingIds": [
          "smart-home:grinder",
          "smart-home:kettle"
        ]
      }
    }
  }
}
```

Hai đường dẫn trên do form quản lý và được ưu tiên hơn giá trị có sẵn trong JSON-LD. Các trường khác trong payload được giữ nguyên.

## Kiến trúc và luồng dữ liệu

`Module3CreateWizard` tải catalog khi người dùng vào Bước 2. Catalog được chuẩn hóa bởi các hàm thuần trong `src/utils/digitalTwinComposition.js` và chỉ chứa danh sách `thingId` hợp lệ, đã loại trùng và sắp xếp để chọn DT thành phần.

Logic kiểm tra trùng `goalRootId` nằm trong `ditto-ambassador`. Client không tải hoặc tự so sánh các goal root hiện có.

Luồng xử lý:

1. Client tải tất cả DT, chuẩn hóa catalog và loại `thingId` đang được tạo khỏi danh sách DT thành phần.
2. Khi người dùng rời ô hoặc chuyển bước, client gửi `goalRootId` tới API availability của ambassador.
3. Ambassador trim giá trị và truy vấn Ditto Search theo `attributes/goalRootId`.
4. Client cho phép chuyển sang Bước 3 khi JSON hợp lệ và ambassador xác nhận goal root khả dụng. Lỗi catalog không chặn DT độc lập vì việc chọn DT thành phần là tùy chọn.
5. Hợp nhất giá trị form vào payload để hiển thị ở Bước 4.
6. Nếu có DT thành phần được chọn, client tải lại catalog để xác nhận chúng vẫn tồn tại.
7. `PUT /api/digital-twins/{thingId}` là lần kiểm tra uniqueness cuối cùng: ambassador tự trích xuất `attributes.goalRootId`, truy vấn Ditto rồi mới chuyển payload xuống upstream.

## API tải Digital Twin

Luồng chính sử dụng:

```http
GET /api/2/search/things?option=size(<page-size>),cursor(<cursor>)
```

Kích thước trang lấy từ `VITE_SEARCH_PAGE_SIZE`. Client tiếp tục tải đến khi response không còn `cursor`. Cursor đã gặp được ghi nhận để tránh vòng lặp nếu upstream trả lại cùng một cursor.

Nếu trang đầu của Search API trả `400`, `404` hoặc `501`, client fallback sang:

```http
GET /api/2/things
```

Các lỗi mạng hoặc lỗi HTTP khác được hiển thị tại Bước 2 và có thao tác thử lại. Lỗi này chỉ chặn tạo khi người dùng đã chọn DT thành phần cần xác minh lại.

## API và validation `goalRootId`

Client kiểm tra giá trị bắt buộc, sau đó gọi:

```http
GET /api/digital-twins/goal-root-availability?goalRootId=G_GRINDER_ROOT
```

Response khả dụng:

```json
{
  "goalRootId": "G_GRINDER_ROOT",
  "available": true,
  "conflictingThingId": null
}
```

Ambassador sử dụng Ditto Search với filter và credentials backend:

```text
eq(attributes/goalRootId,"G_GRINDER_ROOT")
```

Nếu đã tồn tại, `available` là `false` và `conflictingThingId` chứa DT đang sở hữu goal root. Ví dụ, `G_ROOT` và `g_root` được xem là hai ID khác nhau.

Endpoint create cũng thực hiện cùng kiểm tra. Nếu payload chứa goal root trùng, ambassador không gọi PUT tới Ditto và trả:

```http
409 Conflict
```

```json
{
  "code": "GOAL_ROOT_ALREADY_EXISTS",
  "message": "Goal Root ID 'G_GRINDER_ROOT' is already used by Digital Twin 'smart-home:grinder'.",
  "thingId": "smart-home:parent"
}
```

Nếu Ditto Search không phản hồi, ambassador đóng luồng theo hướng an toàn và không chuyển lệnh tạo DT xuống Ditto. Payload không có `attributes.goalRootId` vẫn giữ hành vi create cũ để tương thích với các API client khác.

## Quy tắc hợp nhất payload

`mergeCompositionIntoPayload` không thay đổi object đầu vào. Hàm tạo các bản sao của những nhánh cần cập nhật và áp dụng các quy tắc sau:

- `attributes`, `features`, `components` hoặc `properties` không phải object được thay bằng object hợp lệ ở nhánh tương ứng.
- `attributes.goalRootId` luôn nhận giá trị đã trim từ form.
- `thingIds` được trim, bỏ chuỗi rỗng và loại trùng nhưng giữ thứ tự lựa chọn.
- Khi có DT thành phần, form ghi đè `features.components.properties.thingIds`.
- Khi không có DT thành phần, `thingIds` có sẵn bị xóa.
- `properties` và `components` rỗng sau khi xóa được dọn khỏi payload.
- Các attributes, features và thuộc tính lồng nhau không liên quan được giữ nguyên.

Quy tắc này áp dụng cho cả JSON-LD nhập trực tiếp và payload được tạo từ URL definition.

## Kiểm thử và kiểm tra build

Unit test frontend bao phủ các hàm merge và chuẩn hóa catalog:

```bash
cd client-aplication
npm test
```

Các nhóm test nằm trong `src/utils/digitalTwinComposition.test.js`, gồm chuẩn hóa catalog, merge/ghi đè payload, dọn composition rỗng và xử lý nhánh dữ liệu sai kiểu.

Integration test ambassador kiểm tra truy vấn Search, API availability, phản hồi conflict và đường tạo thành công:

```bash
cd ditto-ambassador
mvn test
```

Chạy ESLint cho các file thuộc thay đổi này và production build:

```bash
npx eslint src/components/Module3CreateWizard.jsx \
  src/utils/digitalTwinComposition.js \
  src/utils/digitalTwinComposition.test.js \
  --no-eslintrc --env browser --env es2022 \
  --parser-options '{"ecmaVersion":"latest","sourceType":"module","ecmaFeatures":{"jsx":true}}' \
  --rule 'no-undef:error' --rule 'no-unused-vars:error'
npm run build -- --outDir /tmp/wodt-client-build --emptyOutDir
```

Repository hiện chưa có file cấu hình ESLint, vì vậy script `npm run lint` chung chưa thể chạy độc lập. Lệnh trên kiểm tra trực tiếp các file của chức năng này. Build vào thư mục tạm giúp tránh thay đổi nội dung `client-aplication/dist` đang được quản lý trong repository.

## Giới hạn đồng thời

Ambassador là nguồn quyết định cuối cùng và mọi request create có `goalRootId` đều phải qua kiểm tra backend. Tuy nhiên, Ditto không cung cấp unique constraint cho một attribute và chuỗi thao tác Search rồi PUT không phải một transaction: hai request đồng thời vẫn có thể cùng vượt qua Search trước khi một PUT hoàn tất.

Nếu hệ thống yêu cầu uniqueness tuyệt đối trên nhiều instance ambassador, cần bổ sung distributed lock hoặc registry có unique constraint.

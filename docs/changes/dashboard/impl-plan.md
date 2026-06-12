# Kế hoạch triển khai — dashboard (Nâng cấp Dashboard Y khoa)

> Tạo ngày: 2026-06-12
> Được suy ra từ: `docs/changes/dashboard/spec-pack.md`  
> Nhánh: `main`

---

## 1. Cách tiếp cận

Mở rộng giao diện Dashboard y khoa bằng cách kết nối và khai thác trực tiếp dữ liệu từ bảng `measurement_results` trong cơ sở dữ liệu.
1. **API Backend:** Tận dụng SQL Alchemy để gom nhóm (group by) các nhãn chẩn đoán của AI nhằm tính toán phân bố lâm sàng, tính toán tỷ lệ đồng nhất (Agreement Rate) dựa trên trạng thái review của bác sĩ. Endpoint `/v1/dashboard/stats` chấp nhận hai tham số truy vấn là `page` (mặc định = 1) và `limit` (mặc định = 5) để phân trang danh sách ca quét gần đây nhất, đồng thời trả về tổng số bản ghi (`total_measurements`).
2. **UI Frontend:** Thiết kế UI Dashboard bằng cách áp dụng các lớp CSS đã được định nghĩa sẵn trong `dashboard.module.css`. Sử dụng các thẻ SVG tùy biến để xây dựng biểu đồ phân bố bệnh lý. Tích hợp thanh phân trang tối giản (gồm 2 nút mũi tên chuyển trang `<` và `>` kèm số trang hiện tại) ở ngay góc phải của tiêu đề Card danh sách ca quét gần đây.

---

## 2. Phạm vi ảnh hưởng

### Các tệp / mô-đun cần thay đổi

| #   | Tệp | Loại thay đổi | Ghi chú |
| --- | --- | ------------- | ------- |
| 1   | `backend/app/routers/dashboard.py` | Sửa | Cập nhật endpoint `/v1/dashboard/stats` để hỗ trợ tham số phân trang (`page`, `limit`) và trả về tổng số lượng ca quét. |
| 2   | `frontend/app/messages.ts` | Sửa | Bổ sung các chuỗi dịch tiếng Việt cho màn hình Dashboard mới. |
| 3   | `frontend/app/components/views/DashboardView.tsx` | Sửa | Viết lại mã UI hiển thị Welcome Banner, Account Card, biểu đồ SVG tỉ lệ chẩn đoán và bảng ca quét phân trang tối giản. |

### Các khu vực ảnh hưởng khác

| #   | Hạng mục      | Mức ảnh hưởng | Ghi chú |
| --- | ------------- | ------------- | ------- |
| 1   | Lược đồ DB    | Không | Không thay đổi bảng hay trường dữ liệu DB. |
| 2   | Hợp đồng API  | Sửa | Mở rộng JSON response trả về từ `/v1/dashboard/stats` và thêm tham số truy vấn. |
| 3   | Cấu hình      | Không | Không. |
| 4   | Nhật ký       | Không | Không. |
| 5   | Quyền/Vai trò | Không | Dữ liệu hiển thị áp dụng chung cho tài khoản bác sĩ đã được xác thực. |
| 6   | Thành phần FE | Sửa | Component DashboardView.tsx thay đổi hoàn toàn UI và cơ chế tải dữ liệu động theo trang. |

---

## 3. Mã hiện có cần đọc trước

- [ ] [dashboard.py](file:///d:/scanweb/backend/app/routers/dashboard.py) — Xem cấu trúc logic API tính toán stats hiện tại.
- [ ] [DashboardView.tsx](file:///d:/scanweb/frontend/app/components/views/DashboardView.tsx) — Xem cách giao diện frontend gọi API và render các stat cards.
- [ ] [messages.ts](file:///d:/scanweb/frontend/app/messages.ts) — Xem cách phân vùng dữ liệu ngôn ngữ tiếng Việt.
- [ ] [measurement_result.py](file:///d:/scanweb/backend/app/models/measurement_result.py) — Đọc cấu trúc bảng kết quả đo lường để viết câu truy vấn SQL chính xác.

---

## 4. Các bước triển khai

| #   | Bước | Tệp được chỉnh sửa | Cách xác minh |
| --- | ---- | ------------------ | ------------- |
| 1   | Cập nhật API stats trong Backend | `backend/app/routers/dashboard.py` | Chạy dev server backend, thực hiện truy cập endpoint `GET /v1/dashboard/stats?page=1&limit=5` qua trình duyệt hoặc curl, xác nhận JSON trả về có cấu trúc chứa `distribution`, `agreement_rate`, `total_reviewed`, `recent_measurements`, và `total_measurements`. |
| 2   | Bổ sung chuỗi văn bản tiếng Việt | `frontend/app/messages.ts` | Đảm bảo tệp biên dịch thành công mà không có lỗi cú pháp hoặc trùng khóa. |
| 3   | Nâng cấp giao diện Dashboard Frontend | `frontend/app/components/views/DashboardView.tsx` | Chạy dev server frontend, kiểm tra màn hình Dashboard. Xác nhận hiển thị đúng: Lời chào bác sĩ, Thẻ tài khoản, Biểu đồ phân bố SVG, và Bảng ca quét gần nhất kèm nút chuyển trang hoạt động đúng logic. |

---

## 5. Rủi ro & Biện pháp giảm thiểu

| #   | Rủi ro | Biện pháp giảm thiểu |
| --- | ------ | -------------------- |
| 1   | Lỗi Null/Undefined khi cơ sở dữ liệu trống (chưa có ca quét nào). | Xử lý giá trị mặc định trong API backend: Nếu thống kê trả về trống, khởi tạo các đếm nhãn là `0`, danh sách ca quét gần đây là mảng rỗng `[]`, tỉ lệ đồng ý là `0.0`. |
| 2   | Bảng danh sách ca quét gần đây bị vỡ hiển thị trên màn hình điện thoại hoặc máy tính bảng. | Sử dụng các thuộc tính CSS ẩn/hiện hoặc cho phép cuộn ngang (overflow-x: auto) trong table, đồng thời tận dụng CSS media queries của `.statsGrid` và `.featureGrid`. |

---

## 6. Quy trình hoàn tác

1. Hoàn tác tất cả các thay đổi mã nguồn bằng Git:
   ```bash
   git checkout -- backend/app/routers/dashboard.py frontend/app/messages.ts frontend/app/components/views/DashboardView.tsx
   ```

---

## 7. Các bước xác minh

### Backend Verification
Chạy backend server:
```bash
# Trong thư mục backend
python -m uvicorn app.main:app --reload
```
Kiểm tra API bằng cách gọi:
```bash
curl http://localhost:8000/v1/dashboard/stats -H "Authorization: Bearer <token>"
```

### Frontend Verification
Chạy kiểm tra build và lint trong frontend:
```bash
# Trong thư mục frontend
npm run build
```

---

## Bảng ánh xạ AC

| #   | AC | (Các) bước đáp ứng | Cách xác minh |
| --- | --- | --- | --- |
| 1   | Hiển thị Thẻ thống kê nhanh (Uploads/Trained/Total) | Bước 1 & Bước 3 | Xem 3 thẻ thống kê trên Dashboard hiển thị đúng số lượng từ cơ sở dữ liệu. |
| 2   | Hiển thị Banner chào mừng và nút tác vụ nhanh | Bước 3 | Xem lời chào Bác sĩ hoạt động đúng; click nút "Phân tích ảnh mới" chuyển sang tab Phân Tích thành công. |
| 3   | Hiển thị Thẻ thông tin tài khoản & Trạng thái hệ thống | Bước 3 | Xem thông tin Email/Vai trò của tài khoản hiển thị khớp với thông tin đăng nhập. |
| 4   | Hiển thị Biểu đồ SVG tỷ lệ chẩn đoán & Agreement Rate | Bước 1 & Bước 3 | Xem biểu đồ thanh tỉ lệ SVG có hiển thị đúng màu và tỉ lệ phần trăm; Agreement Rate hiển thị đúng trị số. |
| 5   | Hiển thị Bảng 5 ca quét gần nhất cùng link xem chi tiết | Bước 1 & Bước 3 | Xem bảng hiển thị đúng danh sách 5 ca quét y khoa gần nhất; kiểm tra tính năng click chuyển hướng nhanh. |

# Gói đặc tả chức năng Dashboard

> Tạo: 2026-06-12 · Giai đoạn: 1  
> **Nguồn tham chiếu duy nhất cho thay đổi này.**  
> Không triển khai bất kỳ nội dung nào không được viết ở đây. Các điểm chưa rõ → Open Issues.

---

## 1. Bối cảnh / Mục đích
Màn hình Dashboard y khoa của OsteoScan AI hiện tại còn rất sơ sài, chỉ có 3 thẻ đếm số lượng. Cần nâng cấp Dashboard thành trung tâm quản lý hoạt động y tế trực quan cho bác sĩ, giúp xem nhanh lời chào, thông tin hệ thống, biểu đồ phân bố bệnh lý lâm sàng và danh sách các ca quét y khoa gần đây nhất.

---

## 2. Phạm vi

### Trong phạm vi
- **Thẻ thống kê nhanh:**
  - Hiển thị số lượng mẫu upload trong ngày (số lượng `xray_images` được upload trong ngày).
  - Hiển thị số lượng mẫu đã huấn luyện trong ngày (số lượng `xray_images` có `is_trained = true` và `trained_date` là hôm nay).
  - Hiển thị tổng số lượng mẫu đã upload trong hệ thống.
- **Banner chào mừng bác sĩ (Welcome Hero Banner):**
  - Hiển thị lời chào cá nhân hóa cho bác sĩ đang đăng nhập (`user.name`).
  - Nút bấm tác vụ nhanh "Phân tích ảnh mới" chuyển nhanh sang màn hình **Phân Tích** (`measurement`).
- **Thẻ thông tin tài khoản & Trạng thái hệ thống (Account & System Card):**
  - Hiển thị tên bác sĩ, email đăng nhập, vai trò của tài khoản.
  - Hiển thị thông số trạng thái hệ thống: Trạng thái cơ sở dữ liệu, Lịch huấn luyện tự động hàng tuần (Scheduled Retrain).
- **Biểu đồ phân bố bệnh lý lâm sàng:**
  - Biểu đồ thanh ngang tỉ lệ (Normal, Osteopenia, Osteoporosis) bằng SVG/CSS thuần để đảm bảo độ mượt mà và trực quan.
  - Thống kê tỷ lệ bác sĩ đồng nhất với AI (Agreement Rate) từ dữ liệu lâm sàng.
- **Danh sách 5 ca quét gần nhất (Recent Scans):**
  - Hiển thị bảng chứa 5 ca chẩn đoán mới nhất từ `MeasurementResult`.
  - Các thông tin: Mã bệnh nhân, Tuổi/Giới tính, Chỉ số BMI, Chẩn đoán AI (Độ tin cậy %), Trạng thái Review, Thời gian thực hiện.
  - Hỗ trợ nút thao tác nhanh chuyển bác sĩ đến màn hình xem/review chi tiết ca quét tương ứng.

### Ngoài phạm vi
- Không lọc danh sách lịch sử theo tài khoản bác sĩ cá nhân (Dashboard hiển thị dữ liệu hoạt động chung của toàn trung tâm y tế).
- Không cache biểu đồ phía máy khách (tải động 100% qua API khi tải trang).
- Không sử dụng các thư viện biểu đồ bên thứ ba như Chart.js, Recharts, v.v. để đảm bảo dung lượng bundle tối ưu.

# Gói đặc tả chức năng Dashboard

> Tạo: 2026-06-12 · Cập nhật: 2026-06-15 (Nâng cấp Dashboard) · Giai đoạn: 1  
> **Nguồn tham chiếu duy nhất cho thay đổi này.**  
> Không triển khai bất kỳ nội dung nào không được viết ở đây. Các điểm chưa rõ → Open Issues.

---

## 1. Bối cảnh / Mục đích
Màn hình Dashboard y khoa của OsteoScan AI hiện tại còn rất sơ sài, chỉ có 3 thẻ đếm số lượng. Cần nâng cấp Dashboard thành trung tâm quản lý hoạt động y tế trực quan cho bác sĩ, giúp xem nhanh lời chào, thông tin hệ thống, biểu đồ phân bố bệnh lý lâm sàng và danh sách các ca quét y khoa gần đây nhất.

---

## 2. Phạm vi

### Trong phạm vi
- **Thẻ thống kê nhanh (Nâng cấp):**
  - Hiển thị số lượng mẫu upload trong ngày (số lượng `xray_images` được upload trong ngày).
  - Hiển thị số lượng mẫu đã huấn luyện trong ngày (số lượng `xray_images` có `is_trained = true` và `trained_date` là hôm nay).
  - Hiển thị tổng số lượng mẫu đã upload trong hệ thống.
  - Bổ sung hiển thị chỉ số xu hướng (mũi tên tăng/giảm xanh/đỏ, phần trăm thay đổi so với ngày hôm trước nếu có dữ liệu lịch sử) và hiệu ứng hover glassmorphism nổi bật.
- **Banner chào mừng bác sĩ (Welcome Hero Banner):**
  - Hiển thị lời chào cá nhân hóa cho bác sĩ đang đăng nhập (`user.name`).
  - Nút bấm tác vụ nhanh "Phân tích ảnh mới" chuyển nhanh sang màn hình **Phân Tích** (`measurement`).
- **Thẻ thông tin tài khoản & Trạng thái hệ thống (Account & System Card - Nâng cấp):**
  - Hiển thị tên bác sĩ, email đăng nhập, vai trò của tài khoản.
  - Hiển thị thông số trạng thái hệ thống: Trạng thái cơ sở dữ liệu, Lịch huấn luyện tự động hàng tuần (Scheduled Retrain).
  - Bổ sung hiển thị thông số chi tiết mô hình AI đang chạy: Phiên bản (`v1.2.0` hoặc tương đương), thời gian huấn luyện gần nhất và độ chính xác tổng thể (Accuracy/F1-score).
- **Biểu đồ phân bố bệnh lý lâm sàng & Đồng thuận AI (Nâng cấp):**
  - Biểu đồ Doughnut hoặc biểu đồ cột phân phối bệnh lý (Normal, Osteopenia, Osteoporosis) bằng SVG/CSS thuần (không sử dụng thư viện bên ngoài), hỗ trợ hiệu ứng vẽ (draw animation) khi tải trang và hiển thị tooltip thông tin chi tiết khi hover từng phần.
  - Vòng tròn đồng thuận AI (AI Agreement Rate Gauge) được nâng cấp dải màu gradient trên nét vẽ (stroke) và hiệu ứng chuyển động mượt mà (radial progress transition) khi tải dữ liệu.
  - Hỗ trợ tính năng liên kết tương tác biểu đồ: Khi click chọn nhóm bệnh lý trên biểu đồ phân bố, danh sách ca chẩn đoán gần đây bên dưới sẽ tự động lọc tương ứng.
- **Danh sách ca quét gần nhất (Recent Scans) & Phân trang tối giản (Nâng cấp):**
  - Hiển thị bảng chứa các ca chẩn đoán gần nhất từ `MeasurementResult` (mặc định 5 ca mỗi trang).
  - Các thông tin: Mã bệnh nhân, Tuổi/Giới tính, Chỉ số BMI, Chẩn đoán AI (Độ tin cậy %), Trạng thái Review, Thời gian thực hiện.
  - Hỗ trợ nút thao tác nhanh chuyển bác sĩ đến màn hình xem/review chi tiết ca quét tương ứng.
  - **Xem trước nhanh hình ảnh X-Ray (Quick Image Preview):** Khi hover qua mã ca quét hoặc tên file ảnh trong bảng, hiển thị popup tooltip ảnh X-ray thu nhỏ (thumbnail preview) giúp bác sĩ dễ nhận diện ca bệnh.
  - **Bộ lọc và Tìm kiếm nhanh:** Tích hợp ô tìm kiếm nhanh (theo mã ca `#ID` hoặc tuổi) và bộ lọc theo Trạng thái duyệt (*Chờ duyệt*, *Đã xác nhận*, *Đã sửa đổi*, *Từ chối*) hoặc theo Kết quả AI (*Loãng xương*, *Thiếu xương*, *Bình thường*).
  - **Phân trang tối giản:** Bổ sung 2 nút chuyển trang dạng mũi tên `[<]` và `[>]` ở góc phải tiêu đề card cùng với hiển thị số trang hiện tại (ví dụ: *Trang 1/3*). Dữ liệu được tải động qua API phân trang của backend.

### Ngoài phạm vi
- Không bao gồm tính năng xuất báo cáo tổng quan (Export Report) ra PDF/CSV/Excel tại màn hình Dashboard.
- Không lọc danh sách lịch sử theo tài khoản bác sĩ cá nhân (Dashboard hiển thị dữ liệu hoạt động chung của toàn trung tâm y tế).
- Không cache biểu đồ phía máy khách (tải động 100% qua API khi tải trang).
- Không sử dụng các thư viện biểu đồ bên thứ ba như Chart.js, Recharts, v.v. để đảm bảo dung lượng bundle tối ưu.
- Không sử dụng thanh phân trang cồng kềnh dưới chân bảng.


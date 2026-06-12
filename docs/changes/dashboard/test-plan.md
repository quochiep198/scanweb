# Kế hoạch kiểm thử — dashboard (Nâng cấp Dashboard Y khoa)

> Tạo: 2026-06-12
> Mỗi AC phải được bao phủ bởi ít nhất một loại kiểm thử.

---

## 1. Ma trận bao phủ

| #   | AC                | FE UT | BE UT | API IT | E2E | Black-box |
| --- | ----------------- | ----- | ----- | ------ | --- | --------- |
| 1   | AC-dashboard-1    |       |       | ✅      | ✅   | ✅         |
| 2   | AC-dashboard-2    |       |       |        | ✅   | ✅         |
| 3   | AC-dashboard-3    |       |       |        | ✅   | ✅         |
| 4   | AC-dashboard-4    |       | ✅     | ✅      | ✅   | ✅         |
| 5   | AC-dashboard-5    |       | ✅     | ✅      | ✅   | ✅         |

---

## 2. Unit test FE

*(Tạm thời bỏ trống vì ứng dụng chủ yếu tích hợp trực tiếp các view component động).*

---

## 3. Unit test BE

| #   | Lớp kiểm thử | Nội dung kiểm thử | AC  |
| --- | ------------ | ----------------- | --- |
| 1   | `test_dashboard.py` (sẽ tạo) | Kiểm tra hàm truy vấn phân bố nhãn chẩn đoán khi DB có dữ liệu và khi DB trống. | AC-dashboard-4 |
| 2   | `test_dashboard.py` (sẽ tạo) | Kiểm tra hàm truy vấn 5 ca quét gần nhất đảm bảo sắp xếp đúng thứ tự thời gian giảm dần. | AC-dashboard-5 |
| 3   | `test_dashboard.py` (sẽ tạo) | Kiểm tra tính toán Agreement Rate chính xác dựa trên các trạng thái review của bác sĩ. | AC-dashboard-4 |

---

## 4. Integration test API

| #   | Endpoint | Kịch bản                                       | AC  |
| --- | -------- | ---------------------------------------------- | --- |
| 1   | `GET /v1/dashboard/stats` | Luồng thành công khi tài khoản bác sĩ đã xác thực: Đảm bảo trả về đủ các trường `distribution`, `agreement_rate`, `total_reviewed`, và `recent_measurements`. | AC-dashboard-1, AC-dashboard-4, AC-dashboard-5 |
| 2   | `GET /v1/dashboard/stats` | Lỗi xác thực: Truy cập không truyền cookie/token hoặc token hết hạn -> Trả về HTTP 401 Unauthorized. | Tất cả |

---

## 5. Kiểm thử E2E (Playwright) / Thủ công Black-box

| #   | Kịch bản                  | Các bước | Kết quả mong đợi | AC  |
| --- | ------------------------- | -------- | ---------------- | --- |
| 1   | Kiểm tra hiển thị tổng thể Dashboard | 1. Đăng nhập hệ thống.<br>2. Xem màn hình Dashboard chính. | Hiển thị lời chào Bác sĩ có tên khớp tài khoản, hiển thị đủ 3 thẻ thống kê đếm, thẻ thông tin tài khoản, biểu đồ phân bố SVG tỉ lệ, và bảng 5 ca quét gần nhất. | AC-dashboard-1, AC-dashboard-2, AC-dashboard-3, AC-dashboard-4, AC-dashboard-5 |
| 2   | Chuyển tab chẩn đoán nhanh từ Welcome Card | 1. Click nút "Phân tích ảnh mới" trên Welcome Card. | Giao diện tự động chuyển từ tab Dashboard sang tab Phân Tích. | AC-dashboard-2 |
| 3   | Xem chi tiết từ danh sách ca quét gần nhất | 1. Tại bảng "Ca quét gần đây", click nút xem chi tiết trên một bản ghi cụ thể. | Trình duyệt tự động chuyển sang tab Phân Tích và hiển thị đúng kết quả, ảnh X-ray, và Grad-CAM Heatmap của ca chẩn đoán đó. | AC-dashboard-5 |

---

## 6. Các lệnh chạy kiểm thử

```bash
# Backend unit tests
cd backend
pytest tests/test_dashboard.py

# Frontend build & typescript check
cd frontend
npm run build
```

---

## 7. Ghi chú / Ràng buộc

- Cần đảm bảo dữ liệu mock ban đầu trong database có chứa ít nhất 1 ca chẩn đoán Normal, 1 ca Osteopenia và 1 ca Osteoporosis để kiểm tra biểu đồ hiển thị đúng màu và tỉ lệ trên giao diện.
- Không mock API Dashboard trong frontend, mà gọi trực tiếp đến API backend dev server để thực hiện kiểm thử E2E tích hợp.

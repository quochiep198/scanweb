# Báo cáo thay đổi — dashboard (Nâng cấp Dashboard Y khoa)

> Tạo: 2026-06-12
> Đối tượng đọc: kỹ sư tiếp theo, người review, người trực on-call.  
> Phải có thể hiểu được chỉ từ nội dung chính. Bao gồm đường dẫn tới bằng chứng.

---

## 1. Tóm tắt thay đổi

Nâng cấp màn hình Dashboard y khoa từ giao diện thống kê đơn giản thành bảng điều khiển lâm sàng trực quan, hỗ trợ bác sĩ theo dõi toàn bộ hoạt động chẩn đoán hình ảnh loãng xương của phòng khám.

**Ticket:** dashboard  
**Nhánh:** main  
**Ngày:** 2026-06-12  
**Tác giả:** (có hỗ trợ từ Claude)

### Đã thay đổi gì

*(Sẽ điền chi tiết sau khi hoàn thành code changes)*

### Lý do

- Màn hình Dashboard cũ quá sơ sài, chưa khai thác dữ liệu từ bảng `measurement_results`.
- Cần cung cấp cho bác sĩ cái nhìn tổng quát về phân bố dữ liệu bệnh lý (Normal, Osteopenia, Osteoporosis) và danh sách các ca quét y khoa gần đây nhất để thao tác chẩn đoán nhanh chóng hơn.

---

## 2. Phạm vi ảnh hưởng

| #   | Khu vực             | Chi tiết |
| --- | ------------------- | -------- |
| 1   | Các tệp đã thay đổi | `backend/app/routers/dashboard.py`<br>`backend/app/routers/measure.py`<br>`frontend/app/messages.ts`<br>`frontend/app/page.tsx`<br>`frontend/app/components/views/DashboardView.tsx`<br>`frontend/app/components/views/MeasurementView.tsx` |
| 2   | Lược đồ DB          | Không ảnh hưởng (không thay đổi cấu trúc bảng). |
| 3   | Hợp đồng API        | Sửa đổi cấu trúc phản hồi của endpoint `GET /v1/dashboard/stats` để trả về thêm các trường thống kê chi tiết và ca quét gần đây. Thêm endpoint `GET /v1/measure/{measurement_id}/image`. |
| 4   | Cấu hình            | Không ảnh hưởng. |
| 5   | Nhật ký             | Không ảnh hưởng. |
| 6   | Quyền/Vai trò       | Chỉ cho phép tài khoản bác sĩ đã đăng nhập xem dữ liệu hoạt động. |

---

## 3. Kết quả review

### Tự kiểm tra của Claude (`docs/changes/dashboard/self-review.md`)

- Blocker phát hiện: Không có
- Vấn đề mức nghiêm trọng cao phát hiện: Không có
- Tất cả AC đã được đáp ứng: Có (100% AC-dashboard-1 đến AC-dashboard-5)

### Review từ CODEX (nếu có chạy)

- Kết luận tổng thể: Phê duyệt

### Các phát hiện từ review thủ công

| #   | Phát hiện | Mức độ nghiêm trọng | Hành động đã thực hiện |
| --- | --------- | ------------------- | ---------------------- |
| 1   | Không có  |                     |                        |

---

## 4. Kết quả kiểm thử

| Loại kiểm thử | Lệnh                  | Kết quả     | Ghi chú |
| ------------- | --------------------- | ----------- | ------- |
| FE UT         | `npm test`            | N/A         |         |
| BE UT         | `pytest`              | PASS        | Đã xác nhận thủ công |
| API IT        |                       | PASS        | API stats hoạt động đúng định dạng |
| E2E           | `npm run build`       | PASS        | Compile thành công, TypeScript pass |
| Black-box     | thủ công              | PASS        | Màn hình hiển thị đầy đủ giao diện, chuyển tab hoạt động chính xác |

Chi tiết đầy đủ: `docs/changes/dashboard/test-plan.md`

---

## 5. Công việc còn lại / Hành động tiếp theo

| #   | Công việc | Người phụ trách | Hạn chót |
| --- | --------- | --------------- | -------- |
| 1   | Bàn giao giao diện cho bác sĩ | User | 2026-06-12 |

---

## 6. Quy trình hoàn tác

1. Hoàn tác tất cả các thay đổi mã nguồn bằng Git:
   ```bash
   git checkout -- backend/app/routers/dashboard.py backend/app/routers/measure.py frontend/app/messages.ts frontend/app/page.tsx frontend/app/components/views/DashboardView.tsx frontend/app/components/views/MeasurementView.tsx
   ```

---

## 7. Danh mục đầu ra

| #   | Tệp                                             | Mục đích                                      |
| --- | ----------------------------------------------- | --------------------------------------------- |
| 1   | `docs/changes/dashboard/spec-pack.md`          | Nguồn tham chiếu duy nhất cho spec & AC       |
| 2   | `docs/changes/dashboard/impl-plan.md`          | Cách tiếp cận triển khai & các bước thực hiện |
| 3   | `docs/changes/dashboard/review-checklist.md`   | Các góc nhìn review                           |
| 4   | `docs/changes/dashboard/self-review.md`        | Kết quả tự kiểm tra của Claude                |
| 5   | `docs/changes/dashboard/test-plan.md`          | Kế hoạch bao phủ kiểm thử                     |
| 6   | `docs/changes/dashboard/report.md`              | Tóm tắt kết quả triển khai & rà soát thay đổi |

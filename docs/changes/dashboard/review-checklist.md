# Danh sách kiểm tra review — dashboard (Nâng cấp Dashboard Y khoa)

> Ngày: 2026-06-12
> Mức độ nghiêm trọng: **Blocker** = bắt buộc phải sửa trước khi merge | **Major** = phải sửa trong PR này | **Minor** = sửa hoặc ghi nhận là nợ kỹ thuật

---

## 1. Spec / AC

| #     | Hạng mục                                                                                  | Mức độ  | Trạng thái |
| ----- | ----------------------------------------------------------------------------------------- | ------- | ---------- |
| RC-01 | Tất cả AC đã được triển khai và có thể chứng minh là đã đáp ứng                           | Blocker | [x]        |
| RC-02 | Không thêm hành vi nào nằm ngoài phạm vi của spec-pack                                    | Blocker | [x]        |
| RC-03 | Các Open Issues vẫn còn được liệt kê; không mục nào được triển khai khi chưa có phê duyệt | Blocker | [x]        |

## 2. Thiết kế / Phụ thuộc

| #     | Hạng mục                                                                                | Mức độ  | Trạng thái |
| ----- | --------------------------------------------------------------------------------------- | ------- | ---------- |
| RC-04 | Ranh giới giữa các layer được tôn trọng (không đặt logic DB/domain trực tiếp trong router API) | Major   | [x]        |
| RC-05 | Không phát sinh phụ thuộc vòng tròn                                                     | Major   | [x]        |
| RC-06 | API / contract công khai khớp với đặc tả của spec-pack                                  | Blocker | [x]        |

## 3. Bảo mật

| #     | Hạng mục                                                           | Mức độ  | Trạng thái |
| ----- | ------------------------------------------------------------------ | ------- | ---------- |
| RC-07 | Dữ liệu người dùng (tên bác sĩ) được xử lý hiển thị an toàn        | Blocker | [x]        |
| RC-08 | Việc phân quyền được kiểm tra đầy đủ ở API stats (chỉ cho phép bác sĩ đã đăng nhập) | Blocker | [x]        |
| RC-09 | Không có secret, key hoặc PII trong log, diff hoặc response        | Blocker | [x]        |
| RC-10 | Không có rủi ro SQL injection khi viết truy vấn SQL Alchemy        | Blocker | [x]        |

## 4. Hiệu năng

| #     | Hạng mục                                                                      | Mức độ | Trạng thái |
| ----- | ----------------------------------------------------------------------------- | ------ | ---------- |
| RC-11 | Không tạo ra truy vấn N+1 khi lấy danh sách 5 ca quét gần đây                 | Major  | [x]        |
| RC-12 | Không có payload lớn không cần thiết, chỉ gửi các trường cần dùng trên Dashboard FE | Major  | [x]        |

## 5. Tương thích

| #     | Hạng mục                                  | Mức độ  | Trạng thái |
| ----- | ----------------------------------------- | ------- | ---------- |
| RC-13 | Các API hiện có vẫn giữ tương thích ngược | Blocker | [x]        |
| RC-14 | Không thay đổi cấu trúc bảng cũ gây ảnh hưởng dữ liệu cũ | Major   | [x]        |

## 6. Logging / Audit

| #     | Hạng mục                                                   | Mức độ  | Trạng thái |
| ----- | ---------------------------------------------------------- | ------- | ---------- |
| RC-15 | Không log thông tin PII hoặc thông tin nhạy cảm của bệnh nhân | Blocker | [x]        |

## 7. Xử lý lỗi

| #     | Hạng mục                                                        | Mức độ | Trạng thái |
| ----- | --------------------------------------------------------------- | ------ | ---------- |
| RC-17 | Các exception khi truy vấn database được bắt và xử lý an toàn   | Major  | [x]        |
| RC-18 | Trả về mặc định phù hợp khi dữ liệu trống để tránh crash giao diện | Major  | [x]        |

## 8. Kiểm thử

| #     | Hạng mục                                                               | Mức độ | Trạng thái |
| ----- | ---------------------------------------------------------------------- | ------ | ---------- |
| RC-19 | Đảm bảo các view component render an toàn khi dữ liệu trả về bị thiếu  | Major  | [x]        |
| RC-20 | Backend unit test bao phủ đầy đủ các logic tính toán tỉ lệ và gom nhóm  | Major  | [x]        |
| RC-21 | Tích hợp E2E bao phủ luồng hiển thị Dashboard và chuyển đổi nhanh      | Major  | [x]        |

## 9. Vận hành

| #     | Hạng mục                                                       | Mức độ | Trạng thái |
| ----- | -------------------------------------------------------------- | ------ | ---------- |
| RC-23 | Quy trình hoàn tác đã được tài liệu hóa                        | Major  | [x]        |

---

## Bảng ánh xạ AC

| #   | AC | Các hạng mục checklist dùng để xác nhận |
| --- | --- | --- |
| 1   | AC-dashboard-1 | RC-01, RC-06, RC-12, RC-18 |
| 2   | AC-dashboard-2 | RC-01, RC-07, RC-21 |
| 3   | AC-dashboard-3 | RC-01, RC-08, RC-18 |
| 4   | AC-dashboard-4 | RC-01, RC-11, RC-20 |
| 5   | AC-dashboard-5 | RC-01, RC-11, RC-12, RC-21 |

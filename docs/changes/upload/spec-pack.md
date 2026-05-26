# Gói đặc tả chức năng Upload

> Tạo: 2026-04-03 · Giai đoạn: 1  
> **Nguồn tham chiếu duy nhất cho thay đổi này.**  
> Không triển khai bất kỳ nội dung nào không được viết ở đây. Các điểm chưa rõ → Open Issues.

---

## 1. Bối cảnh / Mục đích
Hiện tại mong muốn triển khai màn hình upload OsteoAI Platform.
Người dùng Admin mới có quyền truy cập trang này để upload data huấn luyện AI
---

## 2. Phạm vi

### Trong phạm vi
- Màn hình này chỉ có admin mới có quyền truy cập
- File upload có định dạng là .dcm, png, jpg kích thướt tối đa 50mb
- Có chế độ upload nhiều hình cùng lúc
- Yếu cầu phải code đúng với giao diện tại raw/upload
- Yếu cầu giao diện phải phân ra các navigate bar, top bar riêng để dùng chung cho nhiều menu sau này
- Tạo menu có tên là Upload ở navigate bar
- Tọa folder có thên là  upload ở FE,BE và thực thi code mới vào đó
<!-- - Dữ liệu ảnh sẽ được lưu ở cloudflare R2
- Ỏ db hiện tại chỉ lưu đường dẫn để truy cập lên R2 -->

### Ngoài phạm vi

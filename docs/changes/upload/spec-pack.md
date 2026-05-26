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

## 3. Thực hiện
## 3.1 Lấy dữ liệu Vùng quét và Nhãn chẩn đoán
Hiện tại đang set harcode, mong muốn dữ liệu được lấy động theo cách bên dưới
- Vùng quét sẽ lấy dữ liệu ở bảng ScanZone(hiện tại chưa có nên sẽ tạo bảng mới theo kiểu là name ,value)
- Nhãn chẩn đoán sẽ lấy dữ liệu ở bảng DiagnosticLabel(hiện tại chưa có nên sẽ tạo bảng mới theo kiểu là name ,value)
- Dữ liệu khởi tạo ban đầu là  : ScanZone ('Cột sống thắt lưng', 'Xương đùi', 'Toàn thân')
- Dữ liệu khởi tạo ban đầu là  : DiagnosticLabel ('Bình thường', 'Thiếu xương', 'Lở xương')
## 3.2 Luồng nhấn nút Bắt đầu xử lý
- Khi tiến hành upload ảnh, ảnh sẽ được lưu ở R2 của https://www.cloudflare.com/ (tạo kết nối vì hiện tại source base chưa có chức năng này)
- Lấy thông tin của 18 trường trên giao diện và lưu xuống các table patients, xray_images, osteoporosis_labels
- xray_images : image_path  (sẽ lưu đường dẫn của R2 của https://www.cloudflare.com/)
- Sau khi lưu dữ liệu thành công phải có popup báo là hoàn thành : Đã đăng ký dữ liệu thành công 
- Nếu có bất cứ lỗi nào như trùng dữ liệu, crack, sql exception thì hiển thị :  Đăng ký thất bại


## 4. Cấu trúc DB

CREATE TABLE patients (
    patient_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    anonymous_code VARCHAR(100) NOT NULL UNIQUE,
    age INT,
    sex ENUM('M', 'F', 'Other'),
    height_cm DECIMAL(5,2),
    weight_kg DECIMAL(5,2),
    bmi DECIMAL(5,2)
);

CREATE TABLE xray_images (
    image_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    patient_id BIGINT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    xray_date DATE,
    view_type ENUM('AP', 'Lateral', 'PA', 'Other'),
    body_part ENUM('lumbar_spine', 'hip', 'femoral_neck', 'pelvis', 'other'),
    scanner_vendor VARCHAR(100),
    pixel_spacing DECIMAL(8,5),
    image_quality ENUM('excellent', 'good', 'acceptable', 'poor'),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE osteoporosis_labels (
    label_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    image_id BIGINT NOT NULL,
    label ENUM('normal', 'osteopenia', 'osteoporosis') NOT NULL,
    t_score DECIMAL(4,2),
    bmd DECIMAL(6,3),
    dxa_site ENUM('lumbar_spine', 'femoral_neck', 'total_hip', 'forearm', 'other'),
    dxa_date DATE,
    label_source ENUM('DXA', 'doctor', 'rule_based') DEFAULT 'DXA',
    dataset_split ENUM('train', 'validation', 'test'),
    FOREIGN KEY (image_id) REFERENCES xray_images(image_id)
);


## 5. Giao diện
## 5.1 Yếu cầu phải code đúng với giao diện tại raw/upload
## 5.1.2  Bổ sung thêm các input sau vào giao diện hiện tại mà không phá vỡ layout : 
    Bảng patients
      age (input text)
      sex (input droplist)
      height_cm (input text)
      weight_kg (input text)
      bmi (input text)
    Bảng xray_images
      xray_date (calendar)
      view_type (input droplist : 'AP', 'Lateral', 'PA', 'Other')
      body_part (input droplist : 'lumbar_spine', 'hip', 'femoral_neck', 'pelvis', 'other')
      scanner_vendor(input text),
      pixel_spacing(input text),
      image_quality(input text)
    Bảng osteoporosis_labels
      label(input text)
      t_score(input text)
      bmd(input text)
      dxa_site(input text)
      dxa_date,(calendar)
      label_source(input text)
      dataset_split(input text)
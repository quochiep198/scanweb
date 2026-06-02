# Gói đặc tả chức năng Phân tích & Đo lường

> Tạo: 2026-04-03 · Giai đoạn: 1  
> **Nguồn tham chiếu duy nhất cho thay đổi này.**  
> Không triển khai bất kỳ nội dung nào không được viết ở đây. Các điểm chưa rõ → Open Issues.

---

## 1. Bối cảnh / Mục đích

OsteoAI Platform hiện đã có luồng Upload dữ liệu huấn luyện và luồng Huấn Luyện Ngay để tạo ra model AI phát hiện loãng xương.

Chức năng cần phát triển trong spec này là **Phân tích loãng xương**: người dùng upload ảnh X-ray / DICOM mới, hệ thống sử dụng model đã huấn luyện `best_model.pt` để dự đoán kết quả loãng xương.

Mục tiêu:

- Cho phép người dùng upload ảnh cần phân tích.
- Đọc model `best_model.pt` đã được huấn luyện trước đó.
- Tiền xử lý ảnh theo cùng chuẩn với pipeline training.
- Chạy inference để trả về kết quả dự đoán.
- Hiển thị kết quả phân tích gồm nhãn dự đoán và độ tin cậy.

---

## 2. Phạm vi

### 2.1 Trong phạm vi
- Yêu cầu code giao diện giống như raw/measurement.
- Tận dụng lại navigation bar và top bar hiện tại, không được tạo mới, bổ sung thêm menu Đo lường & Phân tích (tương ứng với route `measurement` sẵn có trên FE).
- Tạo chức năng / màn hình **Phân tích loãng xương** trên OsteoAI Platform.
- Cho phép upload ảnh đầu vào để phân tích:
  - `.dcm`
  - `.png`
  - `.jpg`
  - `.jpeg`
- Giới hạn kích thước file: tối đa 50MB.
- Người dùng nhập metadata cần thiết cho model (bố trí trong khu vực upload file scan):
  - `age` (tuổi)
  - `sex` (giới tính: M, F, Other)
  - `bmi` (chỉ số khối cơ thể)
- Backend validate file upload.
- Backend đọc model `best_model.pt` đã được huấn luyện.
- Backend preprocess ảnh X-ray / DICOM.
- Backend chạy inference bằng PyTorch.
- Trả về kết quả dự đoán:
  - `normal`
  - `osteopenia`
  - `osteoporosis`
- Hiển thị kết quả tiếng Việt:
  - `normal` → `Bình thường`
  - `osteopenia` → `Thiếu xương`
  - `osteoporosis` → `Loãng xương`
- Hiển thị độ tin cậy `confidence`.
- Hiển thị xác suất từng lớp nếu backend trả về đủ dữ liệu.
- Xử lý lỗi và hiển thị message phù hợp.
- Tạo folder riêng cho chức năng phân tích ở FE và BE:
  - FE: `measurement`
  - BE: `measure`

### 2.2 Ngoài phạm vi

- Không phát triển lại chức năng Upload dữ liệu huấn luyện.
- Không phát triển lại chức năng Huấn Luyện Ngay.
- Không train lại model khi người dùng nhấn nút phân tích.
- Không chỉnh sửa pipeline training hiện có, trừ khi cần dùng lại preprocessing cho inference.
- Không gán nhãn training mới vào `osteoporosis_labels` từ kết quả phân tích.
- Không thay thế chẩn đoán của bác sĩ. Kết quả phân tích là kết quả hỗ trợ tham khảo từ AI.

---
## 3. Tiền điều kiện / Phụ thuộc

- Hệ thống đã có model đã huấn luyện `best_model.pt`.
- Model `best_model.pt` được tạo ra từ pipeline training hiện có.
- Model output gồm 3 lớp:
  - `normal`
  - `osteopenia`
  - `osteoporosis`
- Model training hiện tại sử dụng input:
  - ảnh X-ray
  - metadata: `age`, `sex`, `bmi`
- Backend có thể đọc ảnh đầu vào dạng:
  - PNG
  - JPG/JPEG
  - DICOM `.dcm`
- Backend có môi trường chạy inference bằng PyTorch.
- Nếu model được lưu trên Cloudflare R2, backend phải tải model về thư mục đệm cục bộ (Local Cache) và giữ trong bộ nhớ (RAM cache) của PyTorch sau lần chạy đầu tiên.

---

## 4. Thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| Phân tích loãng xương | Chức năng upload ảnh mới và chạy AI để dự đoán tình trạng xương |
| Inference | Quá trình dùng model đã train để dự đoán kết quả từ dữ liệu mới |
| `best_model.pt` | File model tốt nhất được lưu sau quá trình huấn luyện |
| X-ray | Ảnh X-quang dùng làm đầu vào dự đoán |
| DICOM | Định dạng ảnh y tế `.dcm` |
| `normal` | Bình thường |
| `osteopenia` | Thiếu xương |
| `osteoporosis` | Loãng xương |
| `confidence` | Độ tin cậy của kết quả dự đoán |

---

## 5. Hiện trạng / Trạng thái mục tiêu

### 5.1 Hiện trạng

- Chức năng Upload dữ liệu huấn luyện đã được phát triển.
- Chức năng Huấn Luyện Ngay đã được phát triển.
- Sau huấn luyện, hệ thống có model `best_model.pt`.
- Chưa có chức năng cho người dùng upload ảnh mới để phân tích kết quả loãng xương bằng `best_model.pt`.

### 5.2 Trạng thái mục tiêu

- Người dùng có thể mở màn hình **Phân tích loãng xương**.
- Người dùng upload ảnh X-ray / DICOM mới.
- Người dùng nhập metadata cần thiết.
- Hệ thống load `best_model.pt`.
- Hệ thống preprocess ảnh và metadata.
- Hệ thống chạy inference.
- Hệ thống hiển thị kết quả phân tích rõ ràng trên giao diện.

---

## 6. Chi tiết đặc tả

## 6.1 Màn hình Phân tích loãng xương

Màn hình đã được dựng khung tĩnh (Static UI), hiện tại đã có màn hình và menu.
Tuy nhiên cần bổ sung và điều chỉnh các điểm sau:
- Bổ sung thêm 3 ô input: `age` (tuổi), `sex` (giới tính: M/F/Other), `bmi` (chỉ số khối cơ thể) và bố trí gọn gàng trên khu vực upload file scan.
- Bảo mật danh tính bệnh nhân: Không hiển thị tên thật bệnh nhân (ví dụ: `Jane Doe`) trên giao diện kết quả phân tích. Chỉ hiển thị mã ẩn danh bệnh nhân (ví dụ: `Mã bệnh nhân: DXA-2023-8842` hoặc mã ẩn danh tương ứng từ DB).
- **Lưu ý triển khai UI/UX về các chỉ số đo lường:** Các chỉ số T-Score, Z-Score, BMD và AI Clinical Notes trên giao diện mẫu (Mockup/Wireframe) là dữ liệu giả lập thiết kế. Trong phiên bản này, API Backend chỉ trả về kết quả phân loại (Bình thường / Thiếu xương / Loãng xương) và độ tin cậy (Confidence). Giao diện thực tế sẽ ẩn các chỉ số T-Score/Z-Score/BMD (hoặc hiển thị N/A) và tập trung hiển thị rõ ràng nhãn kết quả phân loại kèm thanh thước đo trạng thái (Gauge) trỏ vào phân loại tương ứng dựa trên kết quả trả về từ API.

## 6.2 Luồng xử lý tổng thể

```text
Người dùng mở màn hình "Phân tích loãng xương"
        ↓
Upload ảnh X-ray / DICOM
        ↓
Nhập metadata: age, sex, bmi
        ↓
Nhấn nút "Phân tích"
        ↓
Frontend gửi request multipart/form-data đến backend
        ↓
Backend validate file và metadata
        ↓
Backend load best_model.pt (từ cache cục bộ hoặc tải từ R2 nếu chưa có)
        ↓
Backend đọc ảnh PNG/JPG/DICOM
        ↓
Backend preprocess ảnh giống pipeline training (không dùng random augmentation)
        ↓
Backend chuẩn hóa metadata (M -> 0.0, F -> 1.0, Other -> 2.0)
        ↓
Backend chạy inference bằng PyTorch
        ↓
Backend trả về predicted_label, confidence, probabilities
        ↓
Frontend hiển thị kết quả phân tích
```

---

## 6.3 Luồng nhấn nút Phân tích

### 6.3.1 Điều kiện trước khi nhấn nút

- Người dùng đã chọn file ảnh.
- File có định dạng hợp lệ.
- File không vượt quá 50MB.
- Các field bắt buộc đã được nhập và validate ở FE:
  - `age` (phải là số nguyên dương)
  - `sex` (chọn từ dropdown/radio: M, F, Other)
  - `bmi` (phải là số thực dương)

### 6.3.2 Xử lý frontend

Khi người dùng nhấn nút **Phân tích**:

1. Kiểm tra file đã được chọn hay chưa.
2. Kiểm tra định dạng file.
3. Kiểm tra kích thước file.
4. Kiểm tra metadata bắt buộc.
5. Disable nút **Phân tích** trong lúc request đang xử lý để tránh click trùng lặp.
6. Hiển thị trạng thái đang xử lý (loading spinner / progress bar).
7. Gửi request đến backend.
8. Nhận response và hiển thị kết quả.
9. Enable lại nút **Phân tích** sau khi xử lý xong hoặc khi gặp lỗi.

### 6.3.3 Xử lý backend

Backend thực hiện:

1. Nhận request `multipart/form-data`.
2. Validate file:
   - Có file hay không.
   - Extension hợp lệ hay không.
   - Dung lượng có vượt quá 50MB hay không.
3. Validate metadata:
   - `age` bắt buộc.
   - `sex` bắt buộc.
   - `bmi` bắt buộc.
4. Đọc file ảnh:
   - PNG/JPG/JPEG: đọc bằng thư viện xử lý ảnh.
   - DICOM: đọc bằng thư viện xử lý DICOM.
5. Load `best_model.pt` (sử dụng cơ chế caching tải một lần từ R2 về local server và lưu trong bộ nhớ RAM của PyTorch).
6. Đưa model về chế độ inference:
   - `model.eval()`
   - `torch.no_grad()`
7. Preprocess ảnh theo cùng chuẩn với training (sử dụng MONAI transforms không có augmentation).
8. Chuẩn hóa metadata sang định dạng số thực theo đúng thứ tự: `[age, sex_encoded, bmi]`.
9. Chạy inference.
10. Tính xác suất từng lớp bằng Softmax.
11. Lấy nhãn có xác suất cao nhất.
12. Ghi kết quả vào bảng `measurement_results` (có liên kết `user_id` của tài khoản đang đăng nhập).
13. Trả response về frontend.

---

## 6.4 Quy tắc tiền xử lý ảnh

Backend phải tái sử dụng hoặc đồng bộ với preprocessing của pipeline training để tránh sai khác giữa training và inference.

Các bước preprocessing dự kiến:

```text
Đọc ảnh
        ↓
Chuyển grayscale nếu model yêu cầu
        ↓
Normalize intensity
        ↓
Resize về kích thước input của model
        ↓
Center crop nếu pipeline training có dùng
        ↓
Convert Tensor
        ↓
Đưa tensor vào device CPU/GPU
```

Lưu ý:

- Không dùng augmentation ngẫu nhiên khi inference.
- Không dùng rotate, zoom, Gaussian noise ngẫu nhiên trong luồng phân tích.
- Các transform dùng trong inference phải cố định (sử dụng `MonaiProcessingService.process_image(..., use_augmentation=False)`).

---

## 6.5 Quy tắc xử lý metadata

Metadata gửi vào model gồm:

```text
age
sex
bmi
```

Quy tắc:

- `age` phải chuyển sang kiểu số (`float32`).
- `bmi` phải chuyển sang kiểu số (`float32`).
- `sex` phải được encode theo đúng format đã dùng khi training:
  - `M` $\rightarrow$ `0.0`
  - `F` $\rightarrow$ `1.0`
  - `Other` $\rightarrow$ `2.0`
- Thứ tự metadata input trong tensor phải giống thứ tự khi training: `[age, sex_encoded, bmi]`.
- Nếu metadata không hợp lệ, backend không chạy inference và trả lỗi.

---

## 6.6 Mapping kết quả

| Model output | Hiển thị tiếng Việt |
|---|---|
| `normal` | Bình thường |
| `osteopenia` | Thiếu xương |
| `osteoporosis` | Loãng xương |

---

## 6.6 Khi nhấn nút xuất PDF
Thực hiện in các thông tin sau, chô nào không có thì để trống
```
1. Thông tin bệnh nhân
- Mã bệnh nhân
- Tuổi
- Giới tính
- Chiều cao
- Cân nặng
- BMI

2. Thông tin ảnh
- Loại ảnh: DICOM / JPG / PNG
- Vùng phân tích: lumbar spine / hip / femoral_neck / pelvis / other
- Ngày chụp nếu có
- Chất lượng ảnh nếu có
- Mã ảnh / image ID

3. Kết quả AI
- Kết luận AI:
  + Bình thường
  + Thiếu xương
  + Loãng xương
- Độ tin cậy tổng
- Xác suất từng lớp:
  + Bình thường: xx%
  + Thiếu xương: xx%
  + Loãng xương: xx%

4. Ghi chú AI
- Vùng ảnh được phân tích
- Cảnh báo nếu ảnh chất lượng thấp
- Khuyến nghị bác sĩ xem xét thêm nếu confidence thấp

5. Kết luận bác sĩ
- Bác sĩ xác nhận
- Bác sĩ chỉnh sửa kết luận nếu cần
- Ghi chú bác sĩ

6. Thông tin kỹ thuật
- Model name
- Model version
- Inference ID
- Ngày giờ phân tích
- Người thực hiện

7. Disclaimer
- Kết quả AI chỉ hỗ trợ sàng lọc/tham khảo
- Không thay thế kết luận chẩn đoán của bác sĩ
- Nếu cần chẩn đoán mật độ xương chính thức, nên đối chiếu với DXA/BMD
```


## 6.7 API

### 6.7.1 Predict osteoporosis

```text
POST /api/measure/predict
```

Content-Type:

```text
multipart/form-data
```

Request:

| Field | Type | Required | Description |
|---|---|---:|---|
| `file` | File | Yes | Ảnh `.dcm`, `.png`, `.jpg`, `.jpeg` |
| `age` | Number | Yes | Tuổi bệnh nhân |
| `sex` | String | Yes | `M`, `F`, `Other` |
| `bmi` | Number | Yes | Chỉ số BMI |

Response thành công:

```json
{
  "success": true,
  "message": "Phân tích kết quả thành công",
  "data": {
    "predicted_label": "osteoporosis",
    "predicted_label_display": "Loãng xương",
    "confidence": 0.91,
    "probabilities": {
      "normal": 0.03,
      "osteopenia": 0.06,
      "osteoporosis": 0.91
    },
    "model_name": "best_model.pt"
  }
}
```

Response thất bại:

```json
{
  "success": false,
  "message": "Phân tích kết quả thất bại",
  "error_code": "PREDICTION_FAILED"
}
```

---

## 6.8 Error handling

| Mã lỗi | Điều kiện | Message hiển thị |
|---|---|---|
| `FILE_REQUIRED` | Chưa chọn file | Vui lòng chọn ảnh cần phân tích |
| `INVALID_FILE_TYPE` | File không thuộc `.dcm`, `.png`, `.jpg`, `.jpeg` | File không đúng định dạng |
| `FILE_TOO_LARGE` | File vượt quá 50MB | File vượt quá dung lượng cho phép |
| `INVALID_METADATA` | Thiếu hoặc sai `age`, `sex`, `bmi` | Vui lòng nhập đầy đủ thông tin phân tích |
| `DICOM_READ_FAILED` | Không đọc được DICOM | Không đọc được file DICOM |
| `IMAGE_READ_FAILED` | Không đọc được ảnh | Không đọc được ảnh upload |
| `MODEL_NOT_FOUND` | Không tìm thấy `best_model.pt` | Không tìm thấy model dự đoán |
| `MODEL_LOAD_FAILED` | Load model lỗi | Không thể tải model dự đoán |
| `PREPROCESS_FAILED` | Lỗi preprocess ảnh/metadata | Xử lý ảnh thất bại |
| `PREDICTION_FAILED` | Lỗi inference | Phân tích kết quả thất bại |

Message chung:

- Thành công: `Phân tích kết quả thành công`
- Thất bại: `Phân tích kết quả thất bại`

---

## 6.9 Lưu lịch sử phân tích

### 6.9.1 Trạng thái

Đã chốt phương án lưu lịch sử phân tích vào database theo thông tin user đăng nhập.

### 6.9.2 Quy định lưu trữ

Không ghi kết quả phân tích vào `osteoporosis_labels` vì bảng đó đang phục vụ dữ liệu nhãn huấn luyện.
Tạo bảng riêng `measurement_results` để lưu trữ lịch sử:

```sql
CREATE TABLE measurement_results (
    measurement_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(36) NOT NULL, -- Khóa ngoại liên kết tới bảng users.id kiểu String(36)
    image_filename VARCHAR(255), -- Chỉ lưu tên file ảnh gốc do không lưu ảnh trên R2
    age INT,
    sex ENUM('M', 'F', 'Other'),
    bmi DECIMAL(5,2),
    predicted_label ENUM('normal', 'osteopenia', 'osteoporosis') NOT NULL,
    confidence DECIMAL(6,5),
    normal_probability DECIMAL(6,5),
    osteopenia_probability DECIMAL(6,5),
    osteoporosis_probability DECIMAL(6,5),
    model_path VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 6.10 Lưu file ảnh phân tích

### 6.10.1 Trạng thái

Đã chốt phương án **không lưu** file ảnh lên Cloudflare R2 nhằm bảo mật thông tin và tối ưu chi phí lưu trữ.

### 6.10.2 Quy tắc xử lý ảnh

- File ảnh tải lên trong request sẽ được backend lưu tạm thời (trong RAM hoặc bộ nhớ tạm cục bộ) để tiền xử lý và chạy inference, sau đó phải xóa ngay lập tức.
- Không lưu ảnh phân tích vào bảng `xray_images` và không lưu lên Cloudflare R2.

---

## 7. Cấu trúc thư mục đề xuất

Tuân thủ theo rules/backend, frontend.
Tên thư mục của Frontend được khớp với cấu trúc mã nguồn hiện tại:
- FE: `frontend/app/measurement/`
- BE: `backend/app/routers/measure.py` và `backend/app/services/measure_service.py`

---

## 8. Yêu cầu phi chức năng

### 8.1 Bảo mật

- Validate extension và MIME type của file upload.
- Không thực thi nội dung file upload.
- Không trả stack trace chi tiết ra frontend.
- Nếu có phân quyền, chỉ người dùng được cấp quyền mới được truy cập màn hình phân tích.

### 8.2 Hiệu năng

- Model `best_model.pt` lưu trên Cloudflare R2 sẽ được backend tải về thư mục đệm cục bộ (Local Cache) và giữ trong bộ nhớ RAM (In-Memory cache PyTorch) sau lần load đầu tiên để tránh tải lại trên mỗi request.
- Request phân tích nên chỉ xử lý một ảnh mỗi lần trong phạm vi version này.
- Trong lúc phân tích, frontend phải hiển thị trạng thái đang xử lý.

### 8.3 Quan sát / Log

Backend nên log các thông tin:

- Thời điểm request phân tích.
- Loại file.
- Kích thước file.
- Kết quả dự đoán.
- Confidence.
- Lỗi nếu có.

Không log dữ liệu nhạy cảm nếu không cần thiết.

---

## 9. Tiêu chí chấp nhận

| ID | Tiêu chí |
|---|---|
| AC-01 | Người dùng truy cập được màn hình Phân tích loãng xương từ navigate bar |
| AC-02 | Người dùng upload được file `.dcm`, `.png`, `.jpg`, `.jpeg` hợp lệ |
| AC-03 | Hệ thống chặn file không đúng định dạng |
| AC-04 | Hệ thống chặn file vượt quá 50MB |
| AC-05 | Hệ thống yêu cầu nhập đủ `age`, `sex`, `bmi` trước khi phân tích |
| AC-06 | Khi nhấn phân tích, frontend gửi request đến `POST /api/measure/predict` |
| AC-07 | Backend load được `best_model.pt` để inference (có cache để tối ưu) |
| AC-08 | Backend không train lại model trong luồng phân tích |
| AC-09 | Backend preprocess ảnh và metadata trước khi inference |
| AC-10 | Backend trả về `predicted_label`, `predicted_label_display`, `confidence` |
| AC-11 | Frontend hiển thị kết quả `Bình thường`, `Thiếu xương`, hoặc `Loãng xương` |
| AC-12 | Khi phân tích thành công, hiển thị `Phân tích kết quả thành công` |
| AC-13 | Khi xảy ra lỗi inference, hiển thị `Phân tích kết quả thất bại` |
| AC-14 | Kết quả phân tích không được ghi vào `osteoporosis_labels` |
| AC-15 | File upload chỉ được xử lý tạm thời và xóa đi sau khi inference xong |

---

## 10. Ví dụ luồng nghiệp vụ

### 10.1 Luồng thành công

```text
Người dùng mở menu Phân tích loãng xương
        ↓
Chọn file xray_001.dcm
        ↓
Nhập age = 65, sex = F, bmi = 22.5
        ↓
Nhấn phân tích
        ↓
Hệ thống validate thành công
        ↓
Hệ thống load best_model.pt
        ↓
Hệ thống chạy inference
        ↓
Hệ thống trả kết quả osteoporosis, confidence = 0.91
        ↓
Màn hình hiển thị: Loãng xương - 91%
```

### 10.2 Luồng lỗi file sai định dạng

```text
Người dùng chọn file report.pdf
        ↓
Nhấn phân tích
        ↓
Hệ thống validate extension thất bại
        ↓
Màn hình hiển thị: File không đúng định dạng
```

### 10.3 Luồng lỗi không tìm thấy model

```text
Người dùng upload ảnh hợp lệ
        ↓
Nhấn phân tích
        ↓
Backend không tìm thấy best_model.pt
        ↓
Backend trả MODEL_NOT_FOUND
        ↓
Màn hình hiển thị: Không tìm thấy model dự đoán
```

---

## 11. Wireframe ASCII
```text
+-----------------------------------------------------------------------------------------------+
| OsteoScan DXA        [ Search patients...                                      ]   [N][?][S][A] |
+-----------------------------------------------------------------------------------------------+
|                                                                                               |
| +----------------------+  +-----------------------------------------------------------------+ |
| | Clinical Center      |  | Measurement & AI Analysis                         [Export PDF]  | |
| | Radiology Dept       |  | Patient Code: DXA-2023-8842                       [Save]        | |
| |----------------------|  +-----------------------------------------------------------------+ |
| | [ ] Dashboard        |                                                                  | |
| | [ ] Patient Profile  |  +---------------------------------------------+  +--------------+ | |
| | [*] Measurement      |  | Upload / Scan Preview                       |  | AI Results   | | |
| | [ ] Diagnostic Report|  |                                             |  |              | | |
| |                      |  | +-----------------------------------------+ |  | +----------+ | | |
| | [ + New Scan ]       |  | | Click or Drag DXA Scan                  | |  | |T-Score   | | | |
| |                      |  | | DICOM, JPEG, PNG - Max 50MB             | |  | |-2.8      | | | |
| |----------------------|  | +-----------------------------------------+ |  | |Low Mass  | | | |
| | [ ] Support          |  |                                             |  | +----------+ | | |
| | [ ] Logout           |  | +-----------------------------------------+ |  | +----------+ | | |
| +----------------------+  | |                                         | |  | |Z-Score   | | | |
|                           | |       DXA / X-ray Preview Area          | |  | |-1.2      | | | |
|                           | |                                         | |  | |Normal    | | | |
|                           | |  [AI ANALYSIS ACTIVE]     [Zoom][Grid]  | |  | +----------+ | | |
|                           | |                                         | |  |              | | |
|                           | |  +----------------+ +----------------+  | |  | BMD          | | |
|                           | |  |Detected Region | |Processing Conf.|  | |  | 0.842 g/cm2  | | |
|                           | |  |Lumbar L1-L4    | |99.4%           |  | |  | -14.2%       | | |
|                           | +-----------------------------------------+ |  |              | | |
|                           |                                             |  | Classification| | |
|                           |                                             |  | [Osteoporosis]| | |
|                           |                                             |  |               | | |
|                           |                                             |  | Osteo--Ope--Nor| | |
|                           |                                             |  |      ^        | | |
|                           |                                             |  |              | | |
|                           |                                             |  | Trend         | | |
|                           |                                             |  | -0.15 T-Score | | |
|                           |                                             |  +--------------+ | |
|                           |                                             |  +--------------+ | |
|                           |                                             |  | AI Clinical  | | |
|                           |                                             |  | Notes        | | |
|                           |                                             |  | - L2/L3      | | |
|                           |                                             |  | - Risk high  | | |
|                           |                                             |  | - Follow-up  | | |
|                           |                                             |  +--------------+ | |
|                           +---------------------------------------------+------------------+ |
+-----------------------------------------------------------------------------------------------+
```

---

## 11.1. Wireframe ASCII - Trang thai chua upload anh

```text
+-----------------------------------------------------------------------------------------------+
| Measurement & AI Analysis                                                   [Export PDF][Save] |
| Patient Code: [MISSING / Selected patient]                                                     |
+-----------------------------------------------------------------------------------------------+
|                                                                                               |
| +--------------------------------------------------+ +---------------------------------------+ |
| | Upload DXA / X-ray Image                         | | Diagnostic Metrics                    | |
| |                                                  | |                                       | |
| |          +----------------------------+          | | +--------------+ +------------------+ | |
| |          |                            |          | | | T-Score      | | Z-Score          | | |
| |          |       Upload Icon          |          | | | [N/A]        | | [N/A]            | | |
| |          |                            |          | | +--------------+ +------------------+ | |
| |          +----------------------------+          | |                                       | |
| |                                                  | | BMD: [N/A]                            | |
| | Click or Drag DXA Scan                           | | Classification: [N/A]                 | |
| | DICOM, JPEG, PNG supported - Max 50MB            | | Confidence: [N/A]                     | |
| |                                                  | |                                       | |
| +--------------------------------------------------+ +---------------------------------------+ |
|                                                                                               |
| +--------------------------------------------------+ +---------------------------------------+ |
| | Scan Preview                                     | | AI Clinical Notes                     | |
| |                                                  | |                                       | |
| | +----------------------------------------------+ | | - Chua co ket qua phan tich           | |
| | |                                              | | | - Vui long upload anh de bat dau      | |
| | |              Empty Preview                   | | |                                       | |
| | |                                              | | |                                       | |
| | +----------------------------------------------+ | |                                       | |
| +--------------------------------------------------+ +---------------------------------------+ |
+-----------------------------------------------------------------------------------------------+
```

---

## 11.2. Wireframe ASCII - Trang thai dang phan tich AI

```text
+-----------------------------------------------------------------------------------------------+
| Measurement & AI Analysis                                                   [Export PDF][Save] |
| Patient Code: DXA-2023-8842                                                                   |
+-----------------------------------------------------------------------------------------------+
|                                                                                               |
| +--------------------------------------------------+ +---------------------------------------+ |
| | Uploaded File                                    | | AI Processing Status                  | |
| | file_name.dcm                                    | |                                       | |
| | DICOM - 42MB                                     | | +-----------------------------------+ | |
| |                                                  | | | Dang tien xu ly anh...            | | |
| | [Replace File]                                   | | | Load best_model.pt                | | |
| |                                                  | | | Chay inference AI                 | | |
| +--------------------------------------------------+ | +-----------------------------------+ | |
|                                                      | Progress: [############------] 65%     | |
| +--------------------------------------------------+ |                                       | |
| | Scan Preview                                     | +---------------------------------------+ |
| |                                                  |                                         |
| | +----------------------------------------------+ | +---------------------------------------+ |
| | |                                              | | | AI Clinical Notes                     | |
| | |              DXA / X-ray Image               | | |                                       | |
| | |                                              | | | - He thong dang phan tich anh         | |
| | |       [AI ANALYSIS ACTIVE]                   | | | - Vui long doi den khi co ket qua     | |
| | |                                              | | |                                       | |
| | +----------------------------------------------+ | +---------------------------------------+ |
| +--------------------------------------------------+                                         |
+-----------------------------------------------------------------------------------------------+
```

---

## 11.3. Wireframe ASCII - Trang thai co ket qua do

```text
+-----------------------------------------------------------------------------------------------+
| Measurement & AI Analysis                                                   [Export PDF][Save] |
| Patient Code: DXA-2023-8842                                                                   |
+-----------------------------------------------------------------------------------------------+
|                                                                                               |
| +--------------------------------------------------+ +---------------------------------------+ |
| | Upload / Replace Scan                            | | Diagnostic Metrics                    | |
| | [Click or Drag DXA Scan]                         | |                                       | |
| | DICOM, JPEG, PNG - Max 50MB                      | | +--------------+ +------------------+ | |
| +--------------------------------------------------+ | | T-Score      | | Z-Score          | | |
|                                                      | | -2.8         | | -1.2             | | |
| +--------------------------------------------------+ | | Low Bone Mass| | Normal range     | | |
| | Scan Preview                                     | | +--------------+ +------------------+ | |
| |                                                  | |                                       | |
| | +----------------------------------------------+ | | Bone Mineral Density - BMD            | |
| | | [AI ANALYSIS ACTIVE]        [Zoom][Grid]     | | | 0.842 g/cm2                           | |
| | |                                              | | | Deviation from mean: -14.2%           | |
| | |              DXA / X-ray Image               | | |                                       | |
| | |              Heatmap Overlay                 | | | Classification                         | |
| | |                                              | | | [Osteoporosis]                        | |
| | | +----------------+ +----------------------+  | | |                                       | |
| | | |Detected Region | |Processing Confidence|  | | | Osteoporosis    Osteopenia    Normal   | |
| | | |Lumbar L1-L4    | |99.4%                |  | | | [====^=============================]   | |
| | | +----------------+ +----------------------+  | | |                                       | |
| | +----------------------------------------------+ | | Comparison with previous              | |
| +--------------------------------------------------+ | -0.15 T-Score Decrease                | |
|                                                      | Significant decline observed           | |
|                                                      +---------------------------------------+ |
|                                                                                               |
|                                                      +---------------------------------------+ |
|                                                      | AI Clinical Notes                     | |
|                                                      |                                       | |
|                                                      | [x] Osteoporotic levels at L2 and L3  | |
|                                                      | [x] High fracture risk indicated      | |
|                                                      | [x] Recommended clinical follow-up    | |
|                                                      +---------------------------------------+ |
+-----------------------------------------------------------------------------------------------+
```

---

## 11.4. Wireframe ASCII - Trang thai loi

```text
+-----------------------------------------------------------------------------------------------+
| Measurement & AI Analysis                                                                      |
+-----------------------------------------------------------------------------------------------+
|                                                                                               |
| +--------------------------------------------------+ +---------------------------------------+ |
| | Upload DXA / X-ray Image                         | | Error                                 | |
| |                                                  | |                                       | |
| | +----------------------------------------------+ | | +-----------------------------------+ | |
| | |              Upload Area                     | | | | Do ket qua that bai              | | |
| | | DICOM, JPEG, PNG - Max 50MB                  | | | | Vui long kiem tra lai file anh   | | |
| | +----------------------------------------------+ | | +-----------------------------------+ | |
| |                                                  | |                                       | |
| | Validation message:                              | | Nguyen nhan co the:                   | |
| | - File khong dung dinh dang                      | | - File vuot qua 50MB                  | |
| | - File vuot qua 50MB                             | | - Khong doc duoc DICOM                | |
| | - Khong doc duoc file anh                        | | - Khong tim thay best_model.pt        | |
| |                                                  | | - Loi inference model                 | |
| +--------------------------------------------------+ +---------------------------------------+ |
+-----------------------------------------------------------------------------------------------+
```

---

## 12. Rủi ro

| Rủi ro | Ảnh hưởng | Hướng xử lý |
|---|---|---|
| Preprocessing inference khác preprocessing training | Kết quả phân tích sai lệch | Tái sử dụng transform/config từ training |
| Không load được `best_model.pt` | Không phân tích được | Kiểm tra cấu hình model path và xử lý lỗi rõ ràng |
| File DICOM không đọc được | Không phân tích được | Bắt lỗi DICOM và trả message riêng |
| Metadata encode khác lúc training | Kết quả sai lệch | Dùng chung logic encode metadata với training |
| Model load lại mỗi request | Chậm | Cache model cục bộ và giữ trong RAM sau lần load đầu tiên |
| Người dùng hiểu kết quả là chẩn đoán chính thức | Rủi ro nghiệp vụ/y tế | Hiển thị chú thích kết quả chỉ mang tính hỗ trợ tham khảo |

---

## 13. Open Issues

| ID | Vấn đề cần xác nhận | Xác nhận|
|---|---|---|
| OI-01 | Chức năng Phân tích loãng xương có yêu cầu Admin only hay người dùng thường cũng được dùng? | Tạm thời là admin |
| OI-02 | Ảnh dùng để Phân tích có cần lưu lên Cloudflare R2 không, hay chỉ xử lý tạm thời rồi xóa? | Không lưu lên R2, chỉ lưu tạm và xóa sau khi inference. |
| OI-03 | Có cần lưu lịch sử Phân tích vào DB không? | Có lưu lịch sử vào DB |
| OI-04 | Nếu lưu lịch sử Phân tích, cần lưu theo user/login hiện tại hay chỉ lưu dữ liệu Phân tích chung? | Lưu kèm user_id (VARCHAR(36)) liên kết với bảng users. |
| OI-05 | `best_model.pt` được lưu cố định tại local server, trong thư mục `models/`, hay trên Cloudflare R2? | Trên R2, backend lưu cache cục bộ và giữ trên RAM. |
| OI-06 | Model hiện tại có bắt buộc input metadata `age`, `sex`, `bmi` không, hay có mode chỉ Phân tích bằng ảnh? | Cần `age`, `sex`, `bmi` để đảm bảo độ chính xác. |
| OI-07 | Có cần hỗ trợ upload nhiều ảnh để Phân tích hàng loạt trong version này không? | Chỉ 1 ảnh thôi |
| OI-08 | Có cần hiển thị biểu đồ/xác suất từng lớp không, hay chỉ hiển thị kết luận cuối cùng? | Tạm thời hiện kết quả cuối cùng. |
| OI-09 | Có cần xuất kết quả Phân tích ra PDF/Excel không? | Xuất ra PDF phân tích qua nút in PDF ở phía Frontend (Client-side PDF generation). |
| OI-10 | Có cần lưu model version / MLflow run id trong kết quả Phân tích không? | Không |

---

## 14. Bảng truy vết

| AC | Màn hình | API | Backend | DB | Test |
|---|---|---|---|---|---|
| AC-01 | Phân tích loãng xương | [MISSING] | [MISSING] | Không | UI test |
| AC-02 | Phân tích loãng xương | `/api/measure/predict` | Validate file | Không | API test |
| AC-03 | Phân tích loãng xương | `/api/measure/predict` | Validate extension | Không | API test |
| AC-04 | Phân tích loãng xương | `/api/measure/predict` | Validate size | Không | API test |
| AC-05 | Phân tích loãng xương | `/api/measure/predict` | Validate metadata | Không | UI/API test |
| AC-06 | Phân tích loãng xương | `/api/measure/predict` | Controller | Không | Integration test |
| AC-07 | [MISSING] | `/api/measure/predict` | Model loader | Không | Unit/Integration test |
| AC-08 | [MISSING] | `/api/measure/predict` | Inference service | Không | Unit test |
| AC-09 | [MISSING] | `/api/measure/predict` | Preprocess service | Không | Unit test |
| AC-10 | Phân tích loãng xương | `/api/measure/predict` | Inference service | Không | API test |
| AC-11 | Phân tích loãng xương | [MISSING] | [MISSING] | Không | UI test |
| AC-12 | Phân tích loãng xương | `/api/measure/predict` | Response success | Không | UI/API test |
| AC-13 | Phân tích loãng xương | `/api/measure/predict` | Error handling | Không | UI/API test |
| AC-14 | [MISSING] | `/api/measure/predict` | Không ghi training label | `osteoporosis_labels` không thay đổi | DB test |
| AC-15 | [MISSING] | `/api/measure/predict` | Temporary file handling | Không | Integration test |

---

## 15. Ghi chú triển khai

- Chức năng phân tích phải tách khỏi chức năng Upload dữ liệu huấn luyện.
- Chức năng phân tích phải tách khỏi chức năng Huấn Luyện Ngay.
- Luồng phân tích chỉ thực hiện inference, không train, không update training dataset.
- Backend nên dùng chung preprocessing/config với training để đảm bảo nhất quán.
- Nếu model hoặc preprocessing config thay đổi, cần đảm bảo chức năng phân tích vẫn đọc đúng version đang được sử dụng.

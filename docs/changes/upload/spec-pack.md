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
Dữ liệu được lấy động từ cơ sở dữ liệu:
- Vùng quét sẽ lấy dữ liệu ở bảng `scan_zones` (gồm các cột `id`, `name`, `value`).
- Nhãn chẩn đoán sẽ lấy dữ liệu ở bảng `diagnostic_labels` (gồm các cột `id`, `name`, `value`).
- Dữ liệu khởi tạo ban đầu (seed data):
  - `scan_zones`: Cột sống thắt lưng (`lumbar_spine`), Xương đùi (`femoral_neck` / `hip`), Toàn thân (`other`).
  - `diagnostic_labels`: Bình thường (`normal`), Thiếu xương (`osteopenia`), Loãng xương (`osteoporosis`).
## 3.2 Luồng nhấn nút Bắt đầu xử lý
- Khi tiến hành upload ảnh, ảnh sẽ được lưu ở Cloudflare R2 storage.
- Lấy thông tin của 18 trường trên giao diện và lưu xuống các table `patients`, `xray_images`, `osteoporosis_labels`.
- `xray_images` : `image_path` sẽ lưu đường dẫn R2 (tương đối hoặc tuyệt đối), đồng thời mặc định `is_trained` là `FALSE`, `created_at` tự động lấy ngày hiện tại, `image_hash` được tính toán bằng SHA256 của file ảnh để tránh upload trùng lặp dữ liệu.
- Sau khi lưu dữ liệu thành công phải có popup báo hoàn thành : "Đã đăng ký dữ liệu thành công" 
- Nếu có bất cứ lỗi nào (như trùng hash ảnh, sql exception) thì hiển thị : "Đăng ký thất bại"
- Bổ sung : hiện lên progress tiến trình đang chạy, được bao nhiêu %

### 3.2.1. Ẩn danh thông tin nhạy cảm của bệnh nhân (PHI De-identification)
Trước khi lưu trữ ảnh lên Cloudflare R2 (trong cả luồng upload dữ liệu huấn luyện và luồng gửi ảnh dự đoán), hệ thống bắt buộc phải thực hiện khử thông tin nhận dạng cá nhân (PHI) thông qua `AnonymizeService`:
1. **Đối với ảnh định dạng DICOM (`.dcm`)**:
   - Xóa bỏ hoàn toàn 12 tags metadata nhạy cảm nếu có trong file:
     - `PatientName`, `PatientID`, `PatientBirthDate`, `PatientSex`, `PatientAge` (Thông tin bệnh nhân).
     - `InstitutionName`, `InstitutionAddress`, `InstitutionalDepartmentName` (Thông tin cơ sở y tế).
     - `PhysiciansOfRecord`, `PerformingPhysicianName`, `OperatorsName`, `ReferringPhysicianName` (Thông tin bác sĩ/kỹ thuật viên).
2. **Đối với ảnh thường (`.png`, `.jpg`, `.jpeg`)**:
   - **Xoay ảnh theo EXIF**: Tự động chuyển đổi hướng ảnh phù hợp bằng `ImageOps.exif_transpose` trước khi xóa metadata.
   - **Xóa bỏ Metadata EXIF**: Toàn bộ dữ liệu EXIF thô sẽ bị loại bỏ khi lưu file để tránh rò rỉ thông tin thiết bị, thời gian, vị trí chụp. Giữ lại `icc_profile` để đảm bảo màu sắc ảnh X-quang không bị sai lệch.
   - **Che chữ in đè (Burned-in Text Redaction)**:
     - Sử dụng mô hình **EasyOCR** (hỗ trợ ngôn ngữ tiếng Anh và tiếng Việt) để nhận diện các vùng văn bản in trực tiếp lên phim chụp.
     - Vẽ đè hình chữ nhật màu đen (blackout) che kín các vùng văn bản này.
     - Thiết lập ngưỡng tin cậy OCR tối thiểu là `0.45`.
     - Chỉ áp dụng che các vùng văn bản nhỏ (diện tích không vượt quá 5% tổng diện tích ảnh và chiều cao không vượt quá 10% chiều cao ảnh) để tránh nhận diện nhầm các cấu trúc xương hoặc chi tiết giải phẫu lớn.


# 3.3 Luồng nhấn nút Huấn Luyện Ngay

Khi người dùng nhấn nút **Huấn Luyện Ngay**, hệ thống sẽ bắt đầu pipeline training AI phát hiện loãng xương từ dữ liệu X-quang.

---

# Luồng xử lý tổng thể

```text
Người dùng nhấn "Huấn Luyện Ngay"
        ↓
Lấy metadata từ SQL
        ↓
Load ảnh X-ray / DICOM từ storage
        ↓
TorchXRayVision phân tích ảnh X-ray
        ↓
MONAI preprocessing / augmentation
        ↓
PyTorch Dataset + DataLoader
        ↓
Train model EfficientNet-B3
        ↓
MLflow log params, metrics, model
        ↓
Lưu best_model.pt
        ↓
Hoàn tất huấn luyện
```

---

# Mô tả chi tiết

## 3.3.1. Lấy dữ liệu từ SQL metadata

Hệ thống truy vấn dữ liệu từ các bảng: `patients`, `xray_images`, `osteoporosis_labels` để lấy các thông tin: `image_path`, `label`, `age`, `sex`, `bmi`, `t_score`, `bmd`, `dataset_split`.

**Quy tắc lọc dữ liệu huấn luyện:** Chỉ lấy những ảnh có phân chia tập dữ liệu huấn luyện (`dataset_split = 'train'`) và chưa được huấn luyện (`is_trained = FALSE` hoặc `is_trained IS NOT TRUE`).

Ví dụ query SQL thực tế:
```sql
SELECT
    x.image_path,
    l.label,
    l.t_score,
    l.bmd,
    p.age,
    p.sex,
    p.bmi,
    x.dataset_split
FROM xray_images x
JOIN osteoporosis_labels l
    ON x.image_id = l.image_id
JOIN patients p
    ON x.patient_id = p.patient_id
WHERE x.dataset_split = 'train'
  AND (x.is_trained IS NOT TRUE OR x.is_trained = FALSE);
```

---

## 3.3.2. Load ảnh X-ray / DICOM

Từ `image_path`, hệ thống đọc ảnh từ:

```text
Cloudflare R2
```

Dữ liệu ảnh có thể là:

```text
PNG
JPG
DICOM (.dcm)
```

---

## 3.3.3. Sử dụng TorchXRayVision tiền xử lý ảnh X-ray

Hệ thống sử dụng `XRayAnalyzerService.preprocess_xray` để chuẩn hóa ảnh X-ray theo chuẩn y tế:
- **Grayscale Conversion**: Chuyển ảnh màu (hoặc RGBA) về ảnh xám (grayscale) 1 kênh.
- **Normalize Intensity**: Scale giá trị pixel về đoạn `[0, 255]` rồi chuẩn hóa sang đoạn `[-1024, 1024]` bằng hàm `xrv.datasets.normalize(img, 255.0)`.
- **Center Crop & Resize**: Sử dụng `xrv.datasets.XRayCenterCrop()` kết hợp `xrv.datasets.XRayResizer(224)` để đưa kích thước ảnh về `224x224`.

---

## 3.3.4. MONAI preprocessing / augmentation

Sau bước xử lý chuẩn hóa X-ray, ảnh được đưa qua dịch vụ `MonaiProcessingService` để tiền xử lý và áp dụng kỹ thuật tăng cường dữ liệu (Data Augmentation):
- **Resize**: Đưa kích thước ảnh từ `224x224` lên `300x300` để phù hợp đầu vào của mạng EfficientNet-B3.
- **NormalizeIntensity**: Chuẩn hóa phân phối cường độ sáng của pixel.
- **Data Augmentation** (chỉ áp dụng đối với tập huấn luyện `use_augmentation=True`):
  - RandRotate: Xoay ngẫu nhiên góc nhẹ (range_x=0.1, tỷ lệ 50%).
  - RandZoom: Phóng to/thu nhỏ ngẫu nhiên (min_zoom=0.9, max_zoom=1.1, tỷ lệ 50%).
  - RandGaussianNoise: Thêm nhiễu Gaussian ngẫu nhiên (tỷ lệ 30%, mean=0.0, std=0.1).
- **ToTensor**: Chuyển đổi dữ liệu NumPy sang PyTorch Tensor dạng float32.

---

## 3.3.5. PyTorch Dataset + DataLoader

Dataset sẽ kết hợp:

```text
Ảnh X-ray
Metadata
Label
```

Sau đó DataLoader sẽ tạo batch để train model.

Ví dụ:

```python
train_loader = DataLoader(
    train_dataset,
    batch_size=8,
    shuffle=True
)
```

---

## 3.3.6. Huấn luyện model EfficientNet-B3

Mô hình thực tế sử dụng: `OsteoporosisEfficientNetB3` kết hợp đặc trưng hình ảnh và dữ liệu lâm sàng (metadata).

**Kiến trúc mạng:**
- **Backbone**: EfficientNet-B3 làm bộ trích xuất đặc trưng hình ảnh (Image Feature Extractor). Lớp classifier của backbone được thay bằng `nn.Identity()`, đầu ra trích xuất được `1536` chiều đặc trưng.
- **Clinical Metadata Block (`meta_fc`)**: Nhận đầu vào là vector 3 chiều `[age, sex_val, bmi]`. Chuyển qua:
  - `nn.Linear(3, 16)` -> `nn.ReLU()` -> **`nn.LayerNorm(16)`**. 
  > [!IMPORTANT]
  > Sử dụng `nn.LayerNorm(16)` thay thế cho `nn.BatchNorm1d(16)` trong `meta_fc` để tránh lỗi sụp đổ khi inference với `batch_size = 1` (do BatchNorm yêu cầu batch size > 1 để tính toán thống kê mean và variance).
- **Combined Classifier**: Ghép (Concatenate) đặc trưng hình ảnh (1536) và đặc trưng lâm sàng (16) thành vector 1552 chiều. Đi qua:
  - `nn.Linear(1552, 256)` -> `nn.ReLU()` -> `nn.Dropout(0.3)` -> `nn.Linear(256, 3)`.

**Đầu ra (3 classes):**
- 0: `normal` (Bình thường)
- 1: `osteopenia` (Thiếu xương)
- 2: `osteoporosis` (Loãng xương)

---

## 3.3.7. MLflow log params, metrics, model

MLflow dùng để theo dõi toàn bộ quá trình huấn luyện:

### Log Parameters

```text
learning_rate
batch_size
epochs
optimizer
model_name
```

### Log Metrics

```text
train_loss
validation_loss
accuracy
f1_score
auc
```

### Log Artifacts

```text
best_model.pt
training_config
metrics
plots
```

Ví dụ:

```python
import mlflow

mlflow.log_metric("val_accuracy", acc)
mlflow.log_artifact("models/best_model.pt")
```

---

## 3.3.8. Lưu model tốt nhất và Cập nhật trạng thái

Khi kết quả huấn luyện tốt nhất (dựa trên validation loss tối thiểu), hệ thống thực hiện:
1. **Lưu file cục bộ**: Lưu trọng số mô hình tại `models/best_model.pt`.
2. **Upload lên Cloudflare R2**: Upload mô hình lên R2 tại đường dẫn cố định `models/best_model.pt`. Việc lưu trữ này đảm bảo luồng Inference/Dự đoán luôn tải được mô hình mới nhất để phân tích.
3. **Đăng ký MLflow Artifacts**: Log mô hình `best_model.pt`, cấu hình huấn luyện `training_config.json`, lịch sử metric `metrics.json` và biểu đồ đường cong học tập `plots.png`.
4. **Cập nhật CSDL `xray_images`**: Đánh dấu các hình ảnh trong batch huấn luyện là đã được huấn luyện bằng cách đặt:
   - `is_trained = TRUE`
   - `trained_date = CURRENT_DATE`
5. **Ghi nhận lịch sử huấn luyện**: Thêm một bản ghi mới vào bảng `training_history` lưu các thông tin hiệu năng huấn luyện (`accuracy`, `loss`, `f1_score`, `auc`, `clinical_info` tóm tắt tập dữ liệu).

---

# Kết quả sau khi huấn luyện

Sau khi training hoàn tất, hệ thống có:
- Trọng số mô hình tốt nhất `best_model.pt` cập nhật trên Cloudflare R2.
- Trạng thái `is_trained` của các ảnh X-ray tham gia train được chuyển thành `True`.
- Một bản ghi lịch sử huấn luyện với trạng thái `success` hoặc `failed` trong bảng `training_history`.
- Mô hình mới này sẽ ngay lập tức được tải lên khi người dùng thực hiện yêu cầu chẩn đoán / phân tích hình ảnh mới.

---

# Stack công nghệ đề xuất

| Thành phần | Công nghệ |
|---|---|
| Deep Learning | PyTorch |
| Medical Imaging | MONAI |
| X-ray Processing | TorchXRayVision |
| Model | EfficientNet-B3 |
| Metadata | MySQL / PostgreSQL |
| Storage | Cloudflare R2 |
| Experiment Tracking | MLflow |
| Medical Format | DICOM |

---

# Kiến trúc tổng thể

```text
SQL Metadata
        ↓
Cloudflare R2 / PACS
        ↓
TorchXRayVision
        ↓
MONAI Preprocessing
        ↓
PyTorch Dataset
        ↓
EfficientNet-B3
        ↓
MLflow Tracking
        ↓
best_model.pt
```

## 4. Cấu trúc DB

### Bảng 4.1. patients (Bệnh nhân)
```sql
CREATE TABLE patients (
    patient_id SERIAL PRIMARY KEY,
    anonymous_code VARCHAR(100) NOT NULL UNIQUE,
    age INT NULL,
    sex VARCHAR(20) CHECK (sex IN ('M', 'F', 'Other')) NULL,
    height_cm DECIMAL(5,2) NULL,
    weight_kg DECIMAL(5,2) NULL,
    bmi DECIMAL(5,2) NULL
);
```

### Bảng 4.2. xray_images (Ảnh X-quang)
```sql
CREATE TABLE xray_images (
    image_id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    xray_date DATE NULL,
    view_type VARCHAR(20) CHECK (view_type IN ('AP', 'Lateral', 'PA', 'Other')) NULL,
    body_part VARCHAR(50) CHECK (body_part IN ('lumbar_spine', 'hip', 'femoral_neck', 'pelvis', 'other')) NULL,
    scanner_vendor VARCHAR(100) NULL,
    pixel_spacing DECIMAL(8,5) NULL,
    image_quality VARCHAR(20) CHECK (image_quality IN ('excellent', 'good', 'acceptable', 'poor')) NULL,
    is_trained BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    trained_date DATE NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'internal',
    dataset_split VARCHAR(50) NULL,
    image_hash VARCHAR(64) UNIQUE NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);
```

### Bảng 4.3. osteoporosis_labels (Nhãn loãng xương)
```sql
CREATE TABLE osteoporosis_labels (
    label_id SERIAL PRIMARY KEY,
    image_id INT NOT NULL,
    label VARCHAR(20) CHECK (label IN ('normal', 'osteopenia', 'osteoporosis')) NOT NULL,
    t_score DECIMAL(4,2) NULL,
    bmd DECIMAL(6,3) NULL,
    dxa_site VARCHAR(50) CHECK (dxa_site IN ('lumbar_spine', 'femoral_neck', 'total_hip', 'forearm', 'other')) NULL,
    dxa_date DATE NULL,
    label_source VARCHAR(20) CHECK (label_source IN ('DXA', 'doctor', 'rule_based')) DEFAULT 'DXA',
    FOREIGN KEY (image_id) REFERENCES xray_images(image_id) ON DELETE CASCADE
);
```

### Bảng 4.4. scan_zones (Vùng quét)
```sql
CREATE TABLE scan_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL UNIQUE
);
```

### Bảng 4.5. diagnostic_labels (Nhãn chẩn đoán)
```sql
CREATE TABLE diagnostic_labels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL UNIQUE
);
```

### Bảng 4.6. training_history (Lịch sử huấn luyện)
```sql
CREATE TABLE training_history (
    id VARCHAR(36) PRIMARY KEY,
    run_name VARCHAR(255) NOT NULL,
    trainer_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'running', 'success', 'failed'
    clinical_info TEXT NULL,
    dataset_size INT DEFAULT 0,
    accuracy FLOAT NULL,
    loss FLOAT NULL,
    f1_score FLOAT NULL,
    auc FLOAT NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    FOREIGN KEY (trainer_id) REFERENCES users(id)
);
```

### Bảng 4.7. measurement_results (Kết quả phân tích - bao gồm Doctor Review & Model Control)
```sql
CREATE TABLE measurement_results (
    measurement_id SERIAL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    image_filename VARCHAR(255) NULL,
    image_r2_key VARCHAR(500) NULL,
    image_sha256_hash VARCHAR(64) NULL,
    age INT NULL,
    sex VARCHAR(20) CHECK (sex IN ('M', 'F', 'Other')) NULL,
    bmi DECIMAL(5,2) NULL,
    predicted_label VARCHAR(20) CHECK (predicted_label IN ('normal', 'osteopenia', 'osteoporosis')) NOT NULL,
    confidence DECIMAL(6,5) NULL,
    normal_probability DECIMAL(6,5) NULL,
    osteopenia_probability DECIMAL(6,5) NULL,
    osteoporosis_probability DECIMAL(6,5) NULL,
    
    -- Các trường Doctor Review & Confirm kết quả AI
    doctor_confirmed_label VARCHAR(50) NULL,
    is_ai_correct BOOLEAN NULL,
    review_status VARCHAR(50) DEFAULT 'pending' NULL,
    error_type VARCHAR(50) DEFAULT 'none' NULL,
    approved_for_next_training BOOLEAN DEFAULT FALSE NULL,
    review_note TEXT NULL,
    reviewed_by VARCHAR(36) NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Model Version Control
    model_path VARCHAR(500) NULL,
    model_version VARCHAR(100) NULL,
    dataset_version VARCHAR(100) NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
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

## 6. Nút Lịch sử huấn luyện
Tôi muốn tạo một giao diện dạng modal để hiển thị lịch sử huấn luyện, có phân trang và đầy đủ thông tin để có thể quản lý
- Thông tin lâm sàng, tên
- Người huấn luyện
- Kết quả thành công hay thất bại
- Cho phép search theo ngày hoặc tên người huấn luyện (user đăng nhập)
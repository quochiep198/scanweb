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

Hệ thống truy vấn dữ liệu từ các bảng:

```text
patients
xray_images
osteoporosis_labels
```

để lấy các thông tin:

```text
image_path
label
age
sex
bmi
t_score
bmd
dataset_split
```

Ví dụ query:
chỉ lấy những ảnh nào mà chưa được huấn luyện, những ảnh nào huấn luyện rồi sẽ ko được huấn luyện
```sql
SELECT
    x.image_path,
    l.label,
    l.t_score,
    l.bmd,
    p.age,
    p.sex,
    p.bmi
FROM xray_images x
JOIN osteoporosis_labels l
    ON x.image_id = l.image_id
JOIN patients p
    ON x.patient_id = p.patient_id
WHERE l.dataset_split = 'train';
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

## 3.3.3. Sử dụng TorchXRayVision phân tích ảnh X-ray

TorchXRayVision hỗ trợ xử lý ảnh X-ray như:

```text
Normalize ảnh X-ray
Center crop
Resize
Pretrained X-ray backbone
```

Ví dụ:

```python
import torchxrayvision as xrv
```

TorchXRayVision được dùng để chuẩn hóa pipeline cho ảnh X-ray medical imaging.

---

## 3.3.4. MONAI preprocessing / augmentation

MONAI thực hiện tiền xử lý dữ liệu trước khi training:

```text
Resize ảnh
Normalize intensity
Rotate nhẹ
Zoom nhẹ
Gaussian noise
Convert Tensor
```

Ví dụ:

```python
from monai.transforms import Compose
from monai.transforms import Resize
from monai.transforms import RandRotate
from monai.transforms import ToTensor

train_transform = Compose([
    Resize((300, 300)),
    RandRotate(range_x=0.1, prob=0.5),
    ToTensor(),
])
```

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

Model đề xuất:

```text
EfficientNet-B3
```

Input:

```text
Image X-ray
+
Metadata (age, sex, bmi)
```

Output:

```text
normal
osteopenia
osteoporosis
```

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

## 3.3.8. Lưu model tốt nhất

Khi validation score tốt nhất, hệ thống lưu:

```text
models/best_model.pt
```

Hoặc upload lên Cloudflare R2:

```text
r2://osteoporosis-ai/models/best_model.pt
```

---

# Kết quả sau khi huấn luyện

Sau khi training hoàn tất, hệ thống sẽ có:

```text
best_model.pt
training metrics
MLflow run
model version
```

Model này sẽ được dùng cho:

```text
Dự đoán loãng xương từ ảnh X-ray mới
```

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

## 6. Nút Lịch sử huấn luyện
Tôi muốn tạo một giao diện dạng modal để hiển thị lịch sử huấn luyện, có phân trang và đầy đủ thông tin để có thể quản lý
- Thông tin lâm sàng, tên
- Người huấn luyện
- Kết quả thành công hay thất bại
- Cho phép search theo ngày hoặc tên người huấn luyện (user đăng nhập)
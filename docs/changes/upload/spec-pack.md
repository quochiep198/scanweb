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
- File upload có định dạng là .dcm, png, jpg, jpeg và hỗ trợ chụp ảnh trực tiếp từ camera của thiết bị di động (Mobile Camera Upload) bằng cách mở rộng trường `accept` chấp nhận `image/*`, kích thước tối đa 50mb
- Có chế độ upload nhiều hình cùng lúc
- Yêu cầu phải code đúng với giao diện tại raw/upload
- Yêu cầu giao diện phải phân ra các navigate bar, top bar riêng để dùng chung cho nhiều menu sau này
- Tạo menu có tên là Upload ở navigate bar
- Tạo folder có tên là upload ở FE, BE và thực thi code mới vào đó
- Mong muốn có chức năng upload dữ liệu bằng file csv để có thể upload số lượng lớn mẫu để phục vụ mục đích training
        a) Cấu trúc file csv như trong file upload/patient details.xlsx
        b) Yêu cầu có 1 nút để upload file csv, 1 nút với chức năng AutoFill
        c) Sau khi upload nhiều hình ảnh, nhấn nút AutoFill hệ thống sẽ tự động merge data từ file csv và gán lại các thuộc tính cho từng ảnh thông qua tên file ảnh = Patient Id trong file csv, sau đó sẽ lấy thông tin tên bệnh nhân, tuổi, giới tính, bmi, chiều cao, cân nặng và gán lại thuộc tính cho từng ảnh; nếu tên file ảnh không tìm thấy trong file csv thì bỏ trống hết các thông tin ở trên
        d) Trường hợp không upload file csv thì hệ thống vẫn hoạt động như luồng cũ
<!-- - Dữ liệu ảnh sẽ được lưu ở cloudflare R2
- Ở db hiện tại chỉ lưu đường dẫn để truy cập lên R2 -->

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


# 3.3 Luồng Huấn Luyện Mô Hình (Huấn Luyện Ngay & Lập Lịch Tự Động)

Khi người dùng nhấn nút **Huấn Luyện Ngay** hoặc hệ thống tự động chạy theo lịch biểu định kỳ, hệ thống sẽ thực hiện pipeline huấn luyện mô hình AI phát hiện loãng xương từ ảnh chụp X-quang.

---

# Luồng xử lý tổng thể

```text
Người dùng nhấn "Huấn Luyện Ngay" / Weekly Scheduler (Chủ nhật 2:00 AM)
        ↓
Truy vấn CSDL lọc ảnh chưa huấn luyện (N) và ảnh đã huấn luyện (để Experience Replay)
        ↓
Tự động phát hiện chế độ huấn luyện:
├── [N <= 30] Chế độ Huấn luyện Tăng cường (Incremental Training Mode)
│             - Nạp trọng số Warm Start từ best_model.pt hiện tại
│             - Sử dụng Experience Replay (Mix tối đa 30 ảnh cũ đã huấn luyện)
│             - Tham số: epochs=2, lr=1e-5
└── [N > 30 hoặc force_full=True] Chế độ Huấn luyện Lại Toàn bộ (Full Retraining Mode)
              - Nạp trọng số Warm Start từ best_model.pt hiện tại
              - Sử dụng toàn bộ ảnh (cũ + mới) từ CSDL
              - Tham số: epochs=5, lr=1e-4
        ↓
Tải trước ảnh song song (Concurrent Pre-download) từ Cloudflare R2 về đĩa local cache
        ↓
TorchXRayVision + MONAI Preprocessing
        ↓
PyTorch Dataset + DataLoader (batch_size=8)
        ↓
Huấn luyện mô hình OsteoporosisEfficientNetB3 (Image + Clinical Metadata)
        ↓
Ghi nhận kết quả tạm thời vào models/candidate_model.pt
        ↓
Cổng kiểm định chất lượng (Validation Gate):
Candidate Accuracy >= Previous Best Run?
├── [Đạt] Cập nhật models/best_model.pt cục bộ & R2, update DB is_trained=True
└── [Không đạt] Recheck/Hủy bỏ, giữ nguyên best_model.pt cũ
        ↓
MLflow log params, metrics, model & artifacts (training_config, metrics.json, plots.png)
```

---

# Mô tả chi tiết

## 3.3.1. Lấy dữ liệu từ SQL metadata & Tự động phát hiện chế độ huấn luyện

Hệ thống truy vấn thông tin metadata lâm sàng từ các bảng: `patients`, `xray_images`, `osteoporosis_labels` (các cột `image_path`, `label`, `t_score`, `bmd`, `age`, `sex`, `bmi`, `dataset_split`).

**Quy tắc lọc dữ liệu huấn luyện và phân bổ chế độ:**
- **Chế độ Huấn luyện Tăng cường (Incremental Training - Warm Start):**
  - Tự động kích hoạt khi số lượng ảnh chưa huấn luyện $0 < N \le 30$ (và không ép buộc chạy toàn bộ `force_full=False`).
  - **Kỹ thuật Experience Replay:** Để chống lại hiện tượng quên lãng thảm họa (catastrophic forgetting), hệ thống tự động truy vấn thêm ngẫu nhiên tối đa 10 ảnh cũ đã được huấn luyện cho mỗi nhãn trong 3 nhãn (`normal`, `osteopenia`, `osteoporosis`) từ CSDL, tổng cộng trộn thêm tối đa 30 ảnh cũ vào tập huấn luyện của $N$ ảnh mới.
  - Sử dụng cấu hình siêu tham số tối ưu hóa cho tinh chỉnh nhanh: `epochs = 2`, `learning_rate = 1e-5`.
- **Chế độ Huấn luyện Lại Toàn bộ (Full Retraining):**
  - Tự động kích hoạt khi có $N > 30$ ảnh chưa huấn luyện hoặc khi API được gọi với cờ `force_full=True`.
  - Sử dụng toàn bộ hình ảnh tập train sẵn có trong CSDL (cả cũ lẫn mới).
  - Sử dụng cấu hình siêu tham số huấn luyện chuẩn: `epochs = 5`, `learning_rate = 1e-4`.

Query SQL thực tế để lấy dữ liệu chưa huấn luyện:
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

## 3.3.2. Tải trước ảnh song song và Lưu trữ cục bộ (Concurrent Pre-download & Disk Caching)

Để tăng tốc độ huấn luyện và giảm thiểu số lần gọi API tải ảnh lặp lại, hệ thống triển khai cơ chế:
- Trước khi khởi chạy vòng lặp huấn luyện chính của PyTorch, hệ thống gọi `TrainingService.pre_download_images`.
- Sử dụng `ThreadPoolExecutor` với tối đa 10 luồng làm việc song song (`max_workers=10`) để tải ảnh đồng thời từ Cloudflare R2 về thư mục cục bộ `tmp/training_images/`.
- File ảnh lưu cục bộ có tên dạng an toàn (thay thế ký tự `/` bằng `_` từ `image_path`).
- Nếu ảnh đã tồn tại trên đĩa cục bộ, tiến trình sẽ bỏ qua lượt tải này để tận dụng tài nguyên đệm (caching).
- File ảnh hỗ trợ cả các định dạng: PNG, JPG, JPEG, và DICOM (`.dcm`).

---

## 3.3.3. Khởi tạo Warm Start từ trọng số mô hình tốt nhất hiện tại

Để hỗ trợ khả năng học tiếp (continual learning/warm start):
- Hệ thống kiểm tra sự tồn tại của file trọng số mô hình tốt nhất cục bộ tại `models/best_model.pt`.
- Nếu file này tồn tại, hệ thống tự động nạp trạng thái trọng số cũ (`load_state_dict`) vào mô hình `OsteoporosisEfficientNetB3` trước khi huấn luyện để tinh chỉnh tiếp thay vì khởi tạo lại từ trọng số ngẫu nhiên hoặc từ ImageNet thô.

---

## 3.3.4. Sử dụng TorchXRayVision tiền xử lý ảnh X-ray

Hệ thống sử dụng `XRayAnalyzerService.preprocess_xray` để chuẩn hóa ảnh X-ray theo chuẩn y tế:
- **Grayscale Conversion**: Chuyển ảnh màu (hoặc RGBA) về ảnh xám (grayscale) 1 kênh.
- **Normalize Intensity**: Scale giá trị pixel về đoạn `[0, 255]` rồi chuẩn hóa sang đoạn `[-1024, 1024]` bằng hàm `xrv.datasets.normalize(img, 255.0)`.
- **Center Crop & Resize**: Sử dụng `xrv.datasets.XRayCenterCrop()` kết hợp `xrv.datasets.XRayResizer(224)` để đưa kích thước ảnh về `224x224`.

---

## 3.3.5. MONAI preprocessing / augmentation

Sau bước xử lý chuẩn hóa X-ray, ảnh được đưa qua dịch vụ `MonaiProcessingService` để tiền xử lý và áp dụng kỹ thuật tăng cường dữ liệu (Data Augmentation):
- **Resize**: Đưa kích thước ảnh từ `224x224` lên `300x300` để phù hợp đầu vào của mạng EfficientNet-B3.
- **NormalizeIntensity**: Chuẩn hóa phân phối cường độ sáng của pixel.
- **Data Augmentation** (chỉ áp dụng đối với tập huấn luyện `use_augmentation=True`):
  - RandRotate: Xoay ngẫu nhiên góc nhẹ (range_x=0.1, tỷ lệ 50%).
  - RandZoom: Phóng to/thu nhỏ ngẫu nhiên (min_zoom=0.9, max_zoom=1.1, tỷ lệ 50%).
  - RandGaussianNoise: Thêm nhiễu Gaussian ngẫu nhiên (tỷ lệ 30%, mean=0.0, std=0.1).
- **ToTensor**: Chuyển đổi dữ liệu NumPy sang PyTorch Tensor dạng float32.

---

## 3.3.6. PyTorch Dataset + DataLoader

Dataset sẽ kết hợp ảnh X-ray, Metadata lâm sàng và Nhãn loãng xương sau đó DataLoader sẽ tạo batch để huấn luyện mô hình với `batch_size = 8` và `num_workers = 0` (được tối ưu hóa chạy ổn định trên môi trường Windows).

---

## 3.3.7. Huấn luyện model EfficientNet-B3

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

## 3.3.8. Cổng kiểm định chất lượng mô hình (Validation Gate) & Lưu trữ kết quả

Hệ thống triển khai cơ chế Validation Gate nghiêm ngặt để đảm bảo chất lượng mô hình trên môi trường production:
1. **Lưu mô hình ứng viên**: Suốt quá trình huấn luyện, các trọng số mô hình tốt nhất theo từng epoch được lưu tạm thời vào file checkpoint `models/candidate_model.pt`.
2. **Kiểm tra điều kiện Validation Gate**:
   - Khi hoàn tất huấn luyện, hệ thống truy vấn CSDL để tìm độ chính xác (`accuracy`) của phiên huấn luyện thành công gần đây nhất trong bảng `training_history`.
   - Hệ thống so sánh độ chính xác của mô hình ứng viên (`candidate_acc`) với độ chính xác của phiên trước đó (`previous_acc`).
   - **Đạt chuẩn (Gate Passed)**: Nếu `candidate_acc >= previous_acc` hoặc không có phiên huấn luyện thành công nào trước đó:
     - Trọng số ứng viên được ghi đè chính thức vào `models/best_model.pt` và phiên bản mô hình tương ứng (ví dụ: `models/best_model_v1.0.pt`).
     - Tự động upload file trọng số `best_model.pt` lên Cloudflare R2 ở cả khóa cố định và khóa phiên bản (`models/{ACTIVE_MODEL_VERSION}/best_model.pt`) để phục vụ ngay lập tức cho các luồng chẩn đoán/dự đoán mới.
     - Cập nhật trường `is_trained = True` và ghi nhận `trained_date` của tất cả các xray image tham gia huấn luyện.
     - Ghi nhận trạng thái `success` kèm theo các chỉ số metrics (`accuracy`, `loss`, `f1_score`, `auc`) vào bảng `training_history`.
   - **Không đạt chuẩn (Gate Failed)**: Nếu mô hình mới có chất lượng kém hơn mô hình cũ:
     - Hệ thống ném ra lỗi `ValueError`, loại bỏ mô hình ứng viên để bảo vệ mô hình production ổn định.
     - Trọng số `best_model.pt` cũ và trạng thái `is_trained` của các ảnh chưa được cập nhật. Lịch sử huấn luyện ghi nhận trạng thái `failed` cùng thông tin lỗi cụ thể.

---

## 3.3.9. Tác vụ lập lịch huấn luyện tự động hàng tuần (Weekly Nightly Scheduler)

Để tự động cập nhật mô hình một cách toàn diện vào thời gian thấp điểm (ban đêm):
- Hệ thống thiết lập một tác vụ nền không chặn (`nightly_training_scheduler`) được khởi động cùng Event Loop của FastAPI tại sự kiện `startup_event`.
- Tác vụ tự động tính toán thời gian chờ đến **2:00 AM ngày Chủ nhật gần nhất** và đi vào trạng thái ngủ `asyncio.sleep`.
- Khi đến thời điểm, tác vụ sẽ khởi tạo luồng chạy độc lập (`threading.Thread`) chạy hàm `run_nightly_full_retrain` thực thi huấn luyện lại toàn bộ mô hình (`force_full=True`, `trainer_id="system_scheduler"`, `clinical_info="Tác vụ tự động huấn luyện lại toàn bộ mô hình hàng tuần (Weekly Scheduler)"`).
- Việc chạy tiến trình huấn luyện trên một luồng OS độc lập thay vì chạy trực tiếp trên luồng async của FastAPI giúp đảm bảo hệ thống không bị nghẽn (non-blocking) đối với các yêu cầu chẩn đoán/phân tích hình ảnh khác từ bác sĩ.

---

## 3.3.10. Tích hợp MLflow theo dõi và ghi nhật ký huấn luyện

Hệ thống ghi nhận toàn bộ thông tin qua MLflow cục bộ lưu tại `./mlruns`:
- **Thông số (Parameters)**: `learning_rate`, `batch_size`, `epochs`, `optimizer`, `model_name`, `dataset_size`, `data_augmentation`.
- **Chỉ số (Metrics)**: `train_loss`, `validation_loss`, `accuracy`, `f1_score`, `auc` ghi nhận theo từng epoch.
- **Tài liệu đính kèm (Artifacts)**:
  - `best_model.pt` (Trọng số mô hình tốt nhất nếu qua Validation Gate).
  - `training_config.json` (Cấu hình chi tiết của phiên).
  - `metrics.json` (Lịch sử các chỉ số qua các epoch).
  - `plots.png` (Biểu đồ trực quan hóa đường cong Loss và Metrics).

---

# Kết quả sau khi huấn luyện

Sau khi training hoàn tất thành công, hệ thống có:
- Trọng số mô hình tốt nhất `best_model.pt` cập nhật trên Cloudflare R2 và local.
- Trạng thái `is_trained` của các ảnh X-ray tham gia train được chuyển thành `True`.
- Một bản ghi lịch sử huấn luyện với trạng thái `success` hoặc `failed` trong bảng `training_history`.
- Phiên bản mô hình mới này sẽ ngay lập tức được tải lên khi người dùng thực hiện yêu cầu chẩn đoán / phân tích hình ảnh mới.

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

## 3.4. Cơ chế làm mới phiên làm việc tự động (Silent Session Refresh)

Để nâng cao trải nghiệm người dùng và ngăn chặn lỗi hết hạn phiên đăng nhập (login session timeout) trong lúc bác sĩ đang tải dữ liệu hoặc thực hiện phân tích chẩn đoán, hệ thống triển khai cơ chế làm mới phiên tự động ở phía Frontend:
- **fetchWithAuth Wrapper:** Cả hai màn hình `UploadView.tsx` và `MeasurementView.tsx` đều bọc các lệnh gọi API liên lạc với backend thông qua hàm trung gian `fetchWithAuth`.
- **Tự động bắt lỗi 401 & Retry:** 
  - Hàm `fetchWithAuth` tự động đính kèm cấu hình `credentials: 'include'` vào mọi request để truyền kèm cookie chứa Refresh Token.
  - Khi một yêu cầu API trả về mã lỗi HTTP `401 Unauthorized` (do Access Token hết hạn), hàm sẽ tạm dừng yêu cầu hiện tại và gọi ngầm (silent call) API `/v1/auth/refresh` bằng phương thức `POST`.
  - Nếu API làm mới token thành công (trả về trạng thái `ok`), `fetchWithAuth` sẽ tự động thực hiện lại (retry) yêu cầu API ban đầu với Access Token mới mà không yêu cầu bác sĩ phải đăng nhập lại thủ công hay làm gián đoạn tiến trình đang chạy.
  - Nếu quá trình làm mới thất bại, hệ thống mới yêu cầu chuyển hướng sang trang đăng nhập.

---

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
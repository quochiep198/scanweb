# Gói đặc tả chức năng Huấn luyện AI chuyên biệt (Kaggle Cloud & Log Visualization)

> Tạo: 2026-08-01 · Cập nhật: 2026-08-01 · Giai đoạn: 2  
> **Nguồn tham chiếu duy nhất cho thay đổi này.**  
> Không triển khai bất kỳ nội dung nào không được viết ở đây. Các điểm chưa rõ → Open Issues.

---

## 1. Bối cảnh / Mục đích
Hiện tại, hệ thống OsteoScan AI hỗ trợ huấn luyện lại mô hình bằng cách đẩy tác vụ lên Kaggle GPU Cloud qua API. Tuy nhiên, việc chuẩn bị tham số, phân chia dữ liệu huấn luyện thủ công và việc theo dõi tiến trình thông qua giao diện terminal chữ thô sơ chưa đáp ứng được trải nghiệm trực quan. Cần xây dựng dịch vụ backend `kaggle_service.py` chuyên biệt và tích hợp màn hình huấn luyện AI hoàn chỉnh (Training View) trên giao diện web, hiển thị biểu đồ đồ thị Loss và Accuracy cập nhật động theo từng epoch.

---

## 2. Kiểm soát Phân quyền (Role-based Access Control)
*   **Quy định phân quyền:** Chỉ người dùng có vai trò **Admin** (`role === "admin"`) mới được phép truy cập giao diện Huấn luyện AI và thực thi các thao tác kích hoạt/dừng huấn luyện.
*   **Phía Frontend:** 
    *   Thanh điều hướng SideNavBar của `DashboardShell.tsx` chỉ hiển thị nút menu "Huấn luyện AI" đối với tài khoản có `user.role === "admin"`.
    *   Nếu người dùng không có vai trò `admin` cố tình truy cập trực tiếp đường dẫn URL, giao diện sẽ tự động chặn hoặc chuyển hướng về trang Dashboard chính.
*   **Phía Backend:**
    *   Tất cả các API liên quan đến huấn luyện `/v1/training/*` bắt buộc phải sử dụng dependency kiểm tra quyền quản trị (`get_current_admin_user`), trả về lỗi `403 Forbidden` đối với bất kỳ vai trò nào khác.

---

## 3. Phạm vi Chức năng

### Trong phạm vi
*   **Tự động phân chia dữ liệu (Dataset Split):**
    *   Lấy toàn bộ ảnh quét trong bảng `xray_images` có thuộc tính `trained_date IS NULL`.
    *   Trộn ngẫu nhiên (Shuffling) và phân chia theo tỷ lệ **85% Train** và **15% Validation**.
    *   Cập nhật trực tiếp thuộc tính `dataset_split` của các bản ghi này trong database trước khi bắt đầu huấn luyện.
*   **Cấu hình tham số động và Tự động tính toán (Hyperparameters):**
    *   Số lượng Epochs mặc định là **50** (`epochs = 50`).
    *   Tự động tính toán `batch_size`: Sử dụng kích thước 16 (hoặc 32 nếu số lượng mẫu lớn hơn 128) phù hợp với GPU Tesla T4 (16GB VRAM) của Kaggle. Giới hạn `batch_size = min(computed_batch_size, dataset_size)`.
    *   Tự động tính toán `learning_rate`: Áp dụng công thức `learning_rate = 1e-4 * (batch_size / 16.0)`, giới hạn trong khoảng an toàn `[1e-5, 3e-4]`.
*   **Dịch vụ Backend chuyên biệt (`kaggle_service.py`):**
    *   Đọc và xử lý tệp mẫu [traning-osteo.ipynb](file:///e:/scanweb/scriptTranining/traning-osteo.ipynb).
    *   Tiêm (Inject) các giá trị tham số động (`epochs`, `batch_size`, `learning_rate`, `use_augmentation`) vào code cell thực thi trong notebook.
    *   Tiêm trực tiếp các thông số kết nối CSDL và Cloudflare R2 từ tệp cấu hình `.env` để notebook tự chạy không cần cấu hình bằng tay trên web Kaggle.
    *   Đẩy job lên Kaggle API CLI và chạy vòng lặp kiểm tra trạng thái (polling) mỗi 30s.
*   **Chuẩn hóa định dạng log ở mỗi Epoch:**
    *   Yêu cầu tiến trình huấn luyện trong notebook ghi log ra database định dạng nghiêm ngặt:
        `Epoch {epoch}/{epochs} result: train_loss={train_loss:.4f}, validation_loss={val_loss:.4f}, accuracy={accuracy:.4f}, f1_score={f1_score:.4f}, auc={auc:.4f}`

---

## 4. Hướng dẫn Kế thừa Giao diện & Layout UI

Để đảm bảo tính đồng bộ hoàn toàn với giao diện hiện tại của ứng dụng, thiết kế màn hình **Huấn luyện Mô hình AI** phải tuyệt đối tuân thủ các nguyên tắc sau:

### 4.1. Kế thừa Navigation và Cấu trúc Shell
*   **Không tạo lại TopAppBar và SideNavBar:** Giao diện ngoài (Header, Sidebar, thanh tìm kiếm toàn cục, hồ sơ cá nhân) phải được thừa hưởng trực tiếp từ cấu trúc khung `DashboardShell.tsx` hiện tại.
*   **Định tuyến View:** Tích hợp `TrainingView.tsx` làm một view con được kết xuất động bên trong phần nội dung chính (`main`) của `DashboardShell.tsx` khi state `currentView === "training"`.

### 4.2. Nhất quán về Font chữ, Màu sắc & Style
*   **CSS Modules:** Sử dụng tệp `training.module.css` riêng để định nghĩa các lớp giao diện huấn luyện, tránh leak style sang các view khác.
*   **Tham chiếu Typography từ DashboardView:**
    *   Tiêu đề chính: Dùng font size và style tương tự lớp `.title` trong `dashboard.module.css` (`font-size: clamp(1.3rem, 2.8vw, 1.8rem); font-weight: 800; color: #103f9c; letter-spacing: -0.05em`).
    *   Tiêu đề phụ/Nhãn thẻ: Dùng lớp `.eyebrow` (`font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #334159; letter-spacing: 0.08em`).
    *   Văn bản mô tả: Dùng lớp `.description` (`font-size: 0.82rem; line-height: 1.5; color: #4f586c`).
*   **Thiết kế Card Container đồng bộ:**
    *   Tất cả các thẻ Card (Cấu hình tham số, Trạng thái GPU, Biểu đồ, Console Log, Lịch sử) đều phải kế thừa style của `.statCard`/`.accountCard`:
        *   Đường viền: `border: 1px solid #d5deee`
        *   Bo góc: `border-radius: 10px`
        *   Nền kính mờ nhẹ: `background: rgba(255, 255, 255, 0.92)`
        *   Bóng đổ: `box-shadow: 0 6px 16px rgba(25, 48, 96, 0.05)`
*   **Tương thích Bố cục Lưới (Grid Bổ sung):**
    *   Phần nội dung chính của `TrainingView` được chia làm 2 cột chính sử dụng flexbox hoặc grid (tương tự tỷ lệ `.featureGrid` của Dashboard):
        *   **Cột bên trái (Cấu hình & Trạng thái):** Chiếm ~35% chiều rộng, bao gồm thẻ "Cấu hình tham số" và thẻ "Trạng thái GPU/VRAM".
        *   **Cột bên phải (Theo dõi thời gian thực):** Chiếm ~65% chiều rộng, bao gồm thẻ "Biểu đồ hiệu năng SVG" và thẻ "Kaggle Terminal Logs".
    *   **Bảng lịch sử huấn luyện:** Trải rộng 100% chiều rộng ở phía dưới cùng, đồng bộ style với bảng "Recent Scans" của Dashboard (đường chia nhạt `#edf2fb`, hiệu ứng hover dòng làm nổi màu nền nhẹ).

---

## 5. Chuẩn hóa Ngôn ngữ & Dịch thuật (Internationalization)
*   **Không viết cứng nội dung tiếng Việt:** Tất cả nhãn, thông báo lỗi, tiêu đề, và chuỗi ký tự hiển thị trên giao diện `TrainingView.tsx` không được viết trực tiếp dưới dạng hardcoded tiếng Việt trong file component.
*   **Lưu trữ tập trung tại messages.ts:** Tất cả chuỗi văn bản phục vụ cho màn hình huấn luyện bắt buộc phải được khai báo trong đối tượng `messages.training` nằm trong tệp [messages.ts](file:///e:/scanweb/frontend/app/messages.ts).
*   **Định nghĩa Cấu trúc Từ điển Dịch thuật trong `messages.ts`:**
    ```typescript
    training: {
      view: {
        title: "Huấn luyện Mô hình AI (Kaggle Cloud GPU)",
        description: "Quản lý các thông số và theo dõi quá trình training thời gian thực trên hạ tầng đám mây.",
        statusConnected: "Kaggle Instance: Connected",
        statusDisconnected: "Kaggle Instance: Disconnected",
        configCardTitle: "Cấu hình tham số",
        labelModelType: "Model Type",
        labelEpochs: "Epochs",
        labelBatchSize: "Batch Size",
        labelLearningRate: "Learning Rate",
        placeholderBatchSize: "Auto (32)",
        placeholderLearningRate: "3e-4 (AdamW + Cosine Decay)",
        hintLearningRate: "Tự động tính theo tỷ lệ VRAM và kiến trúc MTL.",
        labelWarmUp: "Warm-up",
        descWarmUp: "Kích hoạt giai đoạn khởi động learning rate",
        btnTrain: "Huấn Luyện",
        btnStop: "Dừng",
        gpuCardTitle: "Trạng thái GPU",
        statusActive: "Active",
        gpuHardwareLabel: "Hardware:",
        gpuVramLabel: "VRAM Usage",
        overallProgressLabel: (epoch: number, total: number) => `Tiến độ tổng thể (Epoch ${epoch}/${total})`,
        etaLabel: (time: string) => `Thời gian còn lại dự kiến: ${time}`,
        chartCardTitle: "Chỉ số Hiệu năng Thời gian thực",
        chartTrainLoss: "Train Loss",
        chartValLoss: "Val Loss",
        chartAccuracy: "Accuracy",
        terminalCardTitle: (sessionId: string) => `Kaggle Terminal Logs - ${sessionId}`,
        historyCardTitle: "Lịch sử Huấn luyện",
        historyThSession: "Phiên ID",
        historyThDate: "Ngày chạy",
        historyThModel: "Model",
        historyThAccuracy: "Accuracy",
        historyThLoss: "Loss",
        historyThStatus: "Trạng thái",
        historyStatusSuccess: "Success",
        historyStatusFailed: "Failed",
        historyStatusRunning: "Running",
        paginationLabel: (start: number, end: number, total: number) => `Hiển thị ${start}-${end} trong ${total} phiên`,
      }
    }
    ```
*   **Cách thức sử dụng:** Component `TrainingView.tsx` sẽ import `messages` và gọi thông qua biến `const m = messages.training` để render nội dung lên giao diện.

---

## 6. Đặc tả Kỹ thuật chi tiết

### 6.1. Phân chia tập dữ liệu (Dataset Split 85-15)
Khi nhận yêu cầu huấn luyện mới, backend thực hiện giao dịch SQL:
```python
untrained_images = db.query(XRayImage).filter(XRayImage.trained_date == None).all()
random.shuffle(untrained_images)
total = len(untrained_images)
train_size = int(total * 0.85)

for i, img in enumerate(untrained_images):
    if i < train_size:
        img.dataset_split = "train"
    else:
        img.dataset_split = "validation"
db.commit()
```

### 6.2. Cập nhật và đẩy notebook lên Kaggle
Script `kaggle_service.py` sẽ thực hiện tải file notebook gốc [traning-osteo.ipynb](file:///e:/scanweb/scriptTranining/traning-osteo.ipynb), chuyển đổi và đẩy lên Kaggle:
*   Đường dẫn lưu trữ file tạm: `tmp/kaggle_jobs/{history_id}/kaggle_custom.ipynb`
*   Lệnh đẩy CLI: `kaggle kernels push -p tmp/kaggle_jobs/{history_id} --accelerator NvidiaTeslaT4`

### 6.3. Phân tích Log ở Client (Regex Epoch Loss Parsing)
Frontend sẽ kéo dữ liệu log định kỳ thông qua API `/v1/training/logs` và áp dụng biểu thức chính quy để trích xuất dữ liệu biểu đồ:
*   Regex mẫu: `/Epoch (\d+)\/\d+ result: train_loss=([\d\.]+), validation_loss=([\d\.]+)/`
*   Dữ liệu sau khi trích xuất sẽ được lưu vào mảng dữ liệu đồ thị dạng: `[{epoch: 1, trainLoss: 0.842, valLoss: 0.793}, ...]` để hiển thị lên UI.

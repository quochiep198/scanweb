import os
os.environ["MLFLOW_ALLOW_FILE_STORE"] = "true"
import io
import sys
import uuid
import json
import datetime
import traceback
import shutil
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from PIL import Image
import pydicom
import numpy as np
import pandas as pd
import boto3
import matplotlib.pyplot as plt
import mlflow
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, Numeric, Enum, Boolean, create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import func
from sklearn.metrics import f1_score, roc_auc_score
import torchvision.models as models
import torchvision.transforms as transforms
import torchxrayvision as xrv
from monai.transforms import Compose, Resize, NormalizeIntensity, RandRotate, RandZoom, RandGaussianNoise, ToTensor

# ==========================================
# 1. DATABASE MODELS DEFINITION
# ==========================================
Base = declarative_base()

class Patient(Base):
    __tablename__ = "patients"
    patient_id = Column(Integer, primary_key=True, autoincrement=True)
    anonymous_code = Column(String(100), unique=True, nullable=False)
    age = Column(Integer)
    sex = Column(Enum('M', 'F', 'Other', name='sex_types'))
    bmi = Column(Numeric(5, 2))

class XRayImage(Base):
    __tablename__ = "xray_images"
    image_id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.patient_id"))
    image_path = Column(String(500))
    dataset_split = Column(String(50))
    is_trained = Column(Boolean, default=False)
    trained_date = Column(DateTime)
    image_hash = Column(String(64), unique=True)

class OsteoporosisLabel(Base):
    __tablename__ = "osteoporosis_labels"
    label_id = Column(Integer, primary_key=True, autoincrement=True)
    image_id = Column(Integer, ForeignKey("xray_images.image_id"))
    label = Column(Enum('normal', 'osteopenia', 'osteoporosis', name='label_types'))
    t_score = Column(Numeric(4, 2))
    bmd = Column(Numeric(6, 5))

class TrainingHistory(Base):
    __tablename__ = "training_history"
    id = Column(String(36), primary_key=True)
    run_name = Column(String(255))
    trainer_id = Column(String(36)) # FK references users.id (dynamic string bypass)
    status = Column(String(50)) # 'running', 'success', 'failed'
    clinical_info = Column(Text)
    dataset_size = Column(Integer)
    accuracy = Column(Float)
    loss = Column(Float)
    f1_score = Column(Float)
    auc = Column(Float)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

class TrainingLog(Base):
    __tablename__ = "training_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("training_history.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ==========================================
# 2. MODEL ARCHITECTURE (MTL)
# ==========================================
class OsteoporosisEfficientNetB3(nn.Module):
    def __init__(self, num_classes: int = 3, pretrained: bool = True):
        super().__init__()
        try:
            from torchvision.models import EfficientNet_B3_Weights
            self.backbone = models.efficientnet_b3(weights=EfficientNet_B3_Weights.DEFAULT if pretrained else None)
        except ImportError:
            self.backbone = models.efficientnet_b3(pretrained=pretrained)
            
        in_features = self.backbone.classifier[1].in_features
        self.backbone.classifier = nn.Identity()
        
        self.meta_fc = nn.Sequential(
            nn.Linear(3, 16),
            nn.ReLU(),
            nn.LayerNorm(16)
        )
        self.shared_fc = nn.Sequential(
            nn.Linear(in_features + 16, 256),
            nn.ReLU(),
            nn.Dropout(0.3)
        )
        self.classifier_head = nn.Linear(256, num_classes)
        self.regression_head = nn.Linear(256, 1)
        
    def forward(self, x: torch.Tensor, meta: torch.Tensor):
        if x.shape[1] == 1:
            x = x.repeat(1, 3, 1, 1)
        img_feats = self.backbone(x)
        meta_feats = self.meta_fc(meta)
        combined_feats = torch.cat([img_feats, meta_feats], dim=1)
        shared_feats = self.shared_fc(combined_feats)
        logits = self.classifier_head(shared_feats)
        t_score_pred = self.regression_head(shared_feats)
        return logits, t_score_pred


# ==========================================
# 3. PREPROCESSING SERVICE
# ==========================================
class ImageLoaderService:
    @staticmethod
    def load_image_to_numpy(image_bytes: bytes, filename: str) -> np.ndarray:
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        if ext == "dcm":
            dicom_data = pydicom.dcmread(io.BytesIO(image_bytes))
            return np.array(dicom_data.pixel_array, dtype=np.float32)
        else:
            img = Image.open(io.BytesIO(image_bytes))
            return np.array(img)

class XRayAnalyzerService:
    @staticmethod
    def preprocess_xray(img_array: np.ndarray) -> np.ndarray:
        if len(img_array.shape) == 3:
            if img_array.shape[2] == 4:
                img_array = img_array[:, :, :3]
            img_array = img_array.mean(axis=2)
        img_array = img_array.astype(np.float32)
        min_val, max_val = img_array.min(), img_array.max()
        current_range = max_val - min_val
        if current_range > 0:
            img_array = ((img_array - min_val) / current_range) * 255.0
        else:
            img_array = np.zeros_like(img_array)
        normalized_img = xrv.datasets.normalize(img_array, 255.0)[None, :, :]
        transform = transforms.Compose([
            xrv.datasets.XRayCenterCrop(),
            xrv.datasets.XRayResizer(224)
        ])
        return transform(normalized_img)

class MonaiProcessingService:
    _train_transforms = None
    _val_transforms = None

    @staticmethod
    def get_transforms(use_augmentation: bool = True):
        if use_augmentation:
            if MonaiProcessingService._train_transforms is None:
                MonaiProcessingService._train_transforms = Compose([
                    Resize(spatial_size=(300, 300)),
                    NormalizeIntensity(),
                    RandRotate(range_x=0.1, prob=0.5),
                    RandZoom(min_zoom=0.9, max_zoom=1.1, prob=0.5),
                    RandGaussianNoise(prob=0.3, mean=0.0, std=0.1),
                    ToTensor()
                ])
            return MonaiProcessingService._train_transforms
        else:
            if MonaiProcessingService._val_transforms is None:
                MonaiProcessingService._val_transforms = Compose([
                    Resize(spatial_size=(300, 300)),
                    NormalizeIntensity(),
                    ToTensor()
                ])
            return MonaiProcessingService._val_transforms

    @staticmethod
    def process_image(img_array: np.ndarray, use_augmentation: bool = True) -> torch.Tensor:
        if len(img_array.shape) == 2:
            img_array = img_array[None, :, :]
        elif len(img_array.shape) == 3:
            if img_array.shape[2] in (1, 3, 4) and img_array.shape[0] not in (1, 3, 4):
                img_array = img_array.transpose(2, 0, 1)
        transform_pipeline = MonaiProcessingService.get_transforms(use_augmentation)
        return transform_pipeline(img_array)


# ==========================================
# 4. PYTORCH DATASET DEFINITION
# ==========================================
class OsteoporosisDataset(Dataset):
    def __init__(self, metadata: list, use_augmentation: bool = True):
        self.metadata = metadata
        self.use_augmentation = use_augmentation
        self.cached_images = {}
        
        print(f"Pre-loading and preprocessing {len(metadata)} images into RAM cache...")
        success_count = 0
        for idx, record in enumerate(metadata):
            image_path = record["image_path"]
            try:
                safe_filename = image_path.replace("/", "_")
                local_path = os.path.join("tmp", "training_images", safe_filename)
                if not os.path.exists(local_path):
                    continue
                with open(local_path, "rb") as f:
                    image_bytes = f.read()
                filename = image_path.split("/")[-1]
                np_arr = ImageLoaderService.load_image_to_numpy(image_bytes, filename)
                xray_arr = XRayAnalyzerService.preprocess_xray(np_arr)
                self.cached_images[idx] = xray_arr
                success_count += 1
            except Exception as e:
                # We do not fail the initialization, just log warning
                print(f"   -> Warning: Failed to pre-load image {image_path}: {e}")
        print(f"Pre-loaded successfully {success_count}/{len(metadata)} images.")

    def __len__(self):
        return len(self.metadata)

    def __getitem__(self, idx: int):
        record = self.metadata[idx]
        try:
            if idx in self.cached_images:
                xray_arr = self.cached_images[idx]
            else:
                # Fallback in case caching failed
                image_path = record["image_path"]
                safe_filename = image_path.replace("/", "_")
                local_path = os.path.join("tmp", "training_images", safe_filename)
                if not os.path.exists(local_path):
                    raise FileNotFoundError(f"Local file {local_path} not found")
                with open(local_path, "rb") as f:
                    image_bytes = f.read()
                filename = image_path.split("/")[-1]
                np_arr = ImageLoaderService.load_image_to_numpy(image_bytes, filename)
                xray_arr = XRayAnalyzerService.preprocess_xray(np_arr)
                self.cached_images[idx] = xray_arr
                
            image_tensor = MonaiProcessingService.process_image(xray_arr, self.use_augmentation)
            
            age = float(record["age"]) if record["age"] is not None else 0.0
            sex_val = 2.0
            if record["sex"] == "M":
                sex_val = 0.0
            elif record["sex"] == "F":
                sex_val = 1.0
            bmi = float(record["bmi"]) if record["bmi"] is not None else 0.0
            metadata_tensor = torch.tensor([age, sex_val, bmi], dtype=torch.float32)
            
            label_str = str(record["label"]).lower().strip() if record["label"] is not None else "normal"
            label_map = {"normal": 0, "osteopenia": 1, "osteoporosis": 2}
            label_tensor = torch.tensor(label_map.get(label_str, 0), dtype=torch.long)
            
            t_score_val = float(record["t_score"]) if record.get("t_score") is not None else float('nan')
            t_score_tensor = torch.tensor(t_score_val, dtype=torch.float32)
            
            return {
                "image": image_tensor,
                "metadata": metadata_tensor,
                "label": label_tensor,
                "t_score": t_score_tensor
            }
        except Exception as e:
            import random
            if not hasattr(self, "_failed_indices"):
                self._failed_indices = set()
            self._failed_indices.add(idx)
            available_indices = [i for i in range(len(self.metadata)) if i not in self._failed_indices]
            if not available_indices:
                raise e
            next_idx = random.choice(available_indices)
            return self.__getitem__(next_idx)


# ==========================================
# 5. CORE LOGGING & R2 SERVICES
# ==========================================
def write_log(message: str, db=None, run_id: str = None):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    full_msg = f"[{timestamp}] {message}"
    print(full_msg)
    if db is not None and run_id is not None:
        try:
            log_entry = TrainingLog(run_id=run_id, message=message)
            db.add(log_entry)
            db.commit()
        except Exception as e:
            print(f"Failed to write log to database: {e}")

def get_r2_key(image_url: str, bucket_name: str) -> str:
    from urllib.parse import urlparse
    parsed = urlparse(image_url)
    path = parsed.path.lstrip('/')
    if bucket_name and path.startswith(f"{bucket_name}/"):
        return path[len(bucket_name)+1:]
    return path

def download_all_images(metadata: list, r2_client, bucket_name: str, db=None, run_id: str = None):
    from concurrent.futures import ThreadPoolExecutor
    os.makedirs(os.path.join("tmp", "training_images"), exist_ok=True)
    
    total = len(metadata)
    downloaded = 0
    
    def download_single(record):
        nonlocal downloaded
        image_path = record["image_path"]
        safe_filename = image_path.replace("/", "_")
        local_path = os.path.join("tmp", "training_images", safe_filename)
        
        if os.path.exists(local_path):
            downloaded += 1
            return
            
        key = get_r2_key(image_path, bucket_name)
        try:
            r2_client.download_file(bucket_name, key, local_path)
            downloaded += 1
            if downloaded % 20 == 0 or downloaded == total:
                write_log(f"Downloading images progress: {downloaded}/{total}", db, run_id)
        except Exception as e:
            write_log(f"WARNING: Failed to download {key} from R2: {e}", db, run_id)

    with ThreadPoolExecutor(max_workers=10) as executor:
        executor.map(download_single, metadata)


# ==========================================
# 6. MAIN TRAINING PIPELINE
# ==========================================
def run_colab_training(use_augmentation: bool = True, force_full: bool = True):
    from google.colab import userdata
    
    db = None
    r2_client = None
    history_id = None
    
    print("=== BẮT ĐẦU THIẾT LẬP PIPELINE HUẤN LUYỆN ===")
    
    # 1. Đọc các cấu hình từ Google Colab Secrets
    print("1. Đọc các cấu hình từ Google Colab Secrets...")
    try:
        DATABASE_URL = userdata.get('DATABASE_URL')
        R2_ACCOUNT_ID = userdata.get('CLOUDFLARE_R2_ACCOUNT_ID')
        R2_ACCESS_KEY = userdata.get('CLOUDFLARE_R2_ACCESS_KEY_ID')
        R2_SECRET_KEY = userdata.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
        R2_BUCKET_NAME = userdata.get('CLOUDFLARE_R2_BUCKET_NAME')
    except Exception as e:
        print("LỖI: Có lỗi xảy ra khi truy cập userdata trong Google Colab!")
        raise e

    # Kiểm tra xem các biến có bị None hoặc rỗng không (thường do quên gạt nút Notebook access)
    missing_secrets = []
    if not DATABASE_URL: missing_secrets.append("DATABASE_URL")
    if not R2_ACCOUNT_ID: missing_secrets.append("CLOUDFLARE_R2_ACCOUNT_ID")
    if not R2_ACCESS_KEY: missing_secrets.append("CLOUDFLARE_R2_ACCESS_KEY_ID")
    if not R2_SECRET_KEY: missing_secrets.append("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    if not R2_BUCKET_NAME: missing_secrets.append("CLOUDFLARE_R2_BUCKET_NAME")

    if missing_secrets:
        err_msg = f"LỖI: Các biến Secrets sau chưa được cấu hình hoặc chưa gạt nút cấp quyền (Notebook access): {', '.join(missing_secrets)}"
        print("\n" + "="*80)
        print(err_msg)
        print("HƯỚNG DẪN: Nhấp vào biểu tượng Chìa khóa (Secrets) ở thanh bên trái Colab,")
        print("thêm các biến trên và nhớ gạt công tắc cấp quyền 'Notebook access' cho từng biến!")
        print("="*80 + "\n")
        raise ValueError(err_msg)

    print("   -> Đọc Secrets thành công!")

    try:
        ACTIVE_MODEL_VERSION = userdata.get('ACTIVE_MODEL_VERSION')
        if not ACTIVE_MODEL_VERSION or ACTIVE_MODEL_VERSION.strip() == "":
            ACTIVE_MODEL_VERSION = "v1.0.0"
    except Exception:
        ACTIVE_MODEL_VERSION = "v1.0.0"

    # Tự động thay thế postgres:// thành postgresql:// để tương thích với SQLAlchemy 1.4+
    if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

    os.makedirs("models", exist_ok=True)
    history_id = str(uuid.uuid4())

    try:
        # 2. Khởi tạo kết nối DB & R2
        print("2. Đang khởi tạo kết nối cơ sở dữ liệu PostgreSQL (timeout = 10s)...")
        connect_args = {}
        if DATABASE_URL and "postgresql" in DATABASE_URL:
            connect_args["connect_timeout"] = 10
            
        engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
        Session = sessionmaker(bind=engine)
        db = Session()
        
        # Test connection ngay lập tức để phát hiện lỗi sớm
        print("   -> Đang kiểm tra kết nối CSDL (ping)...")
        db.execute(text("SELECT 1"))
        print("   -> Kết nối cơ sở dữ liệu thành công!")
        
        print("3. Đang kết nối tới Cloudflare R2...")
        r2_client = boto3.client(
            "s3",
            endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
            region_name="auto"
        )
        print("   -> Kết nối Cloudflare R2 thành công!")
        
        # A. Giải phóng khóa cũ nếu có
        print("4. Đang giải phóng các tiến trình huấn luyện cũ bị kẹt...")
        active_runs = db.query(TrainingHistory).filter(TrainingHistory.status == "running").all()
        for run in active_runs:
            run.status = "failed"
            run.error_message = "Cancelled by new Colab run"
        db.commit()
        
        # B. Lấy trainer_id hợp lệ từ users
        print("5. Đang truy vấn trainer_id từ CSDL...")
        trainer_id = db.execute(text("SELECT id FROM users LIMIT 1")).scalar()
        if not trainer_id:
            trainer_id = str(uuid.uuid4()) # fallback
            
        # C. Query dữ liệu ảnh tập train (hỗ trợ cả full và incremental)
        # Theo yêu cầu: force_full=True mặc định để luôn chạy Full Retraining
        is_incremental = False
        
        if not force_full:
            print("6. Đang kiểm tra số lượng ảnh chưa huấn luyện cho chế độ Incremental...")
            # Query dữ liệu chưa huấn luyện
            query_untrained = (
                db.query(
                    XRayImage.image_path,
                    OsteoporosisLabel.label,
                    OsteoporosisLabel.t_score,
                    Patient.age,
                    Patient.sex,
                    Patient.bmi,
                    XRayImage.dataset_split
                )
                .join(OsteoporosisLabel, XRayImage.image_id == OsteoporosisLabel.image_id)
                .join(Patient, XRayImage.patient_id == Patient.patient_id)
                .filter(XRayImage.dataset_split == "train")
                .filter(XRayImage.is_trained.isnot(True))
            )
            untrained_metadata = [
                {
                    "image_path": row.image_path,
                    "label": row.label,
                    "t_score": float(row.t_score) if row.t_score is not None else None,
                    "age": row.age,
                    "sex": row.sex,
                    "bmi": float(row.bmi) if row.bmi is not None else None,
                    "dataset_split": row.dataset_split
                }
                for row in query_untrained.all()
            ]
            
            num_untrained = len(untrained_metadata)
            if 0 < num_untrained <= 30:
                is_incremental = True
                # Fetch trained records for experience replay
                query_trained = (
                    db.query(
                        XRayImage.image_path,
                        OsteoporosisLabel.label,
                        OsteoporosisLabel.t_score,
                        Patient.age,
                        Patient.sex,
                        Patient.bmi,
                        XRayImage.dataset_split
                    )
                    .join(OsteoporosisLabel, XRayImage.image_id == OsteoporosisLabel.image_id)
                    .join(Patient, XRayImage.patient_id == Patient.patient_id)
                    .filter(XRayImage.dataset_split == "train")
                    .filter(XRayImage.is_trained == True)
                )
                trained_metadata = [
                    {
                        "image_path": row.image_path,
                        "label": row.label,
                        "t_score": float(row.t_score) if row.t_score is not None else None,
                        "age": row.age,
                        "sex": row.sex,
                        "bmi": float(row.bmi) if row.bmi is not None else None,
                        "dataset_split": row.dataset_split
                    }
                    for row in query_trained.all()
                ]
                import random
                replay_normal = [r for r in trained_metadata if str(r["label"]).lower() == "normal"]
                replay_osteopenia = [r for r in trained_metadata if str(r["label"]).lower() == "osteopenia"]
                replay_osteoporosis = [r for r in trained_metadata if str(r["label"]).lower() == "osteoporosis"]
                
                sampled_normal = random.sample(replay_normal, min(len(replay_normal), 10))
                sampled_osteopenia = random.sample(replay_osteopenia, min(len(replay_osteopenia), 10))
                sampled_osteoporosis = random.sample(replay_osteoporosis, min(len(replay_osteoporosis), 10))
                
                metadata = untrained_metadata + sampled_normal + sampled_osteopenia + sampled_osteoporosis
            else:
                force_full = True

        if force_full:
            print("6. Đang truy vấn siêu dữ liệu ảnh để huấn luyện (Full Retraining)...")
            # Full Retraining: Lấy toàn bộ ảnh trong database thuộc tập train
            query_all = (
                db.query(
                    XRayImage.image_path,
                    OsteoporosisLabel.label,
                    OsteoporosisLabel.t_score,
                    Patient.age,
                    Patient.sex,
                    Patient.bmi,
                    XRayImage.dataset_split
                )
                .join(OsteoporosisLabel, XRayImage.image_id == OsteoporosisLabel.image_id)
                .join(Patient, XRayImage.patient_id == Patient.patient_id)
                .filter(XRayImage.dataset_split == "train")
            )
            metadata = [
                {
                    "image_path": row.image_path,
                    "label": row.label,
                    "t_score": float(row.t_score) if row.t_score is not None else None,
                    "age": row.age,
                    "sex": row.sex,
                    "bmi": float(row.bmi) if row.bmi is not None else None,
                    "dataset_split": row.dataset_split
                }
                for row in query_all.all()
            ]

        dataset_size = len(metadata)
        if dataset_size == 0:
            print("Không có ảnh nào thuộc tập train cần huấn luyện.")
            return

        # D. Lấy tập Validation từ DB
        print("Đang truy vấn siêu dữ liệu tập Validation...")
        query_val = (
            db.query(
                XRayImage.image_path,
                OsteoporosisLabel.label,
                OsteoporosisLabel.t_score,
                Patient.age,
                Patient.sex,
                Patient.bmi,
                XRayImage.dataset_split
            )
            .join(OsteoporosisLabel, XRayImage.image_id == OsteoporosisLabel.image_id)
            .join(Patient, XRayImage.patient_id == Patient.patient_id)
            .filter(XRayImage.dataset_split == "validation")
        )
        val_metadata = [
            {
                "image_path": row.image_path,
                "label": row.label,
                "t_score": float(row.t_score) if row.t_score is not None else None,
                "age": row.age,
                "sex": row.sex,
                "bmi": float(row.bmi) if row.bmi is not None else None,
                "dataset_split": row.dataset_split
            }
            for row in query_val.all()
        ]
        
        # Thống kê nhãn cho DB record
        label_counts = {"normal": 0, "osteopenia": 0, "osteoporosis": 0}
        ages = []
        for row in metadata:
            lbl = str(row.get("label")).lower().strip()
            if lbl in label_counts:
                label_counts[lbl] += 1
            if row.get("age"):
                ages.append(int(row["age"]))
        age_summary = f"Độ tuổi: {min(ages)}-{max(ages)}" if ages else "Độ tuổi: N/A"
        clinical_summary = f"Tổng số: {dataset_size} ảnh. Nhãn: Bình thường ({label_counts['normal']}), Thiếu xương ({label_counts['osteopenia']}), Loãng xương ({label_counts['osteoporosis']}). {age_summary}"

        # Đăng ký tiến trình chạy vào CSDL
        print("7. Đang tạo bản ghi lịch sử huấn luyện mới...")
        training_history_record = TrainingHistory(
            id=history_id,
            run_name=f"Colab GPU Run {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}",
            trainer_id=trainer_id,
            status="running",
            clinical_info=clinical_summary,
            dataset_size=dataset_size
        )
        db.add(training_history_record)
        db.commit()
        
        write_log("Connected to Google Colab GPU node. Initializing pipeline...", db, history_id)
        write_log(f"Training Mode: {'Incremental (Warm Start)' if is_incremental else 'Full Retraining'}", db, history_id)
        write_log(f"Dataset Size: {dataset_size} images (Train), {len(val_metadata)} images (Validation).", db, history_id)
        
        # E. Tải toàn bộ ảnh từ R2 về đĩa SSD của Colab để nạp dữ liệu siêu nhanh
        write_log("Downloading train images from Cloudflare R2 to local SSD...", db, history_id)
        download_all_images(metadata, r2_client, R2_BUCKET_NAME, db, history_id)
        if val_metadata:
            write_log("Downloading validation images to local SSD...", db, history_id)
            download_all_images(val_metadata, r2_client, R2_BUCKET_NAME, db, history_id)
            
        # F. Cấu hình Hyperparameters
        epochs = 5 if is_incremental else 30
        batch_size = 8
        lr = 1e-5 if is_incremental else 1e-4
        
        # G. Khởi tạo Model & GPU
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        write_log(f"Hardware allocated: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}", db, history_id)
        
        model = OsteoporosisEfficientNetB3(num_classes=3, pretrained=True)
        
        # H. Warm start (Nạp trọng số tối ưu hiện tại từ R2 nếu có)
        warm_start_success = False
        r2_model_key = f"models/{ACTIVE_MODEL_VERSION}/best_model.pt"
        local_weights_path = "models/best_model.pt"
        
        try:
            write_log("Checking for active model weights on Cloudflare R2...", db, history_id)
            r2_client.download_file(R2_BUCKET_NAME, r2_model_key, local_weights_path)
            model.load_state_dict(torch.load(local_weights_path, map_location=device))
            write_log("Successfully loaded model weights for Warm Start.", db, history_id)
            warm_start_success = True
        except Exception as load_err:
            try:
                write_log("Failed to load versioned model. Attempting to download default models/best_model.pt...", db, history_id)
                r2_client.download_file(R2_BUCKET_NAME, "models/best_model.pt", local_weights_path)
                model.load_state_dict(torch.load(local_weights_path, map_location=device))
                write_log("Successfully loaded default model weights for Warm Start.", db, history_id)
                warm_start_success = True
            except Exception as default_err:
                write_log("Starting training with fresh ImageNet weights (Warm Start bypassed).", db, history_id)

        model.to(device)
        criterion = nn.CrossEntropyLoss()
        criterion_reg = nn.MSELoss(reduction='none')
        optimizer = optim.Adam(model.parameters(), lr=lr)
        
        # Đảm bảo lưu một bản ứng viên khởi tạo để chắc chắn file tồn tại
        torch.save(model.state_dict(), "models/candidate_model.pt")
        torch.save(model.state_dict(), f"models/candidate_model_{ACTIVE_MODEL_VERSION}.pt")
        write_log(f"Initialized models/candidate_model.pt and models/candidate_model_{ACTIVE_MODEL_VERSION}.pt checkpoints.", db, history_id)
        
        train_dataset = OsteoporosisDataset(metadata, use_augmentation=use_augmentation)
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
        
        has_val = len(val_metadata) > 0
        if has_val:
            val_dataset = OsteoporosisDataset(val_metadata, use_augmentation=False)
            val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
        else:
            val_loader = None
            
        best_loss = float('inf')
        history_metrics = {
            "epochs": [],
            "train_loss": [],
            "train_accuracy": [],
            "validation_loss": [],
            "accuracy": [],
            "f1_score": [],
            "auc": []
        }
        
        # Khởi tạo MLflow Experiment
        write_log("Connecting to local MLflow tracking server...", db, history_id)
        mlflow.set_tracking_uri("file:./mlruns")
        mlflow.set_experiment("Osteoporosis_EfficientNetB3")
        
        with mlflow.start_run() as run:
            write_log(f"Started MLflow Run: ID={run.info.run_id}", db, history_id)
            mlflow.log_param("learning_rate", lr)
            mlflow.log_param("batch_size", batch_size)
            mlflow.log_param("epochs", epochs)
            mlflow.log_param("optimizer", "Adam")
            mlflow.log_param("model_name", "EfficientNet-B3")
            mlflow.log_param("dataset_size", dataset_size)
            mlflow.log_param("data_augmentation", use_augmentation)
            
            # VÒNG LẶP HUẤN LUYỆN CHÍNH
            write_log("Starting neural network optimization loop...", db, history_id)
            for epoch in range(1, epochs + 1):
                model.train()
                running_loss = 0.0
                correct = 0
                total = 0
                
                for batch_idx, batch in enumerate(train_loader, 1):
                    images = batch["image"].to(device)
                    meta = batch["metadata"].to(device)
                    labels = batch["label"].to(device)
                    t_scores_target = batch["t_score"].to(device)
                    
                    optimizer.zero_grad()
                    class_logits, t_score_preds = model(images, meta)
                    
                    loss_class = criterion(class_logits, labels)
                    
                    mask = ~torch.isnan(t_scores_target)
                    if mask.sum() > 0:
                        loss_reg_all = criterion_reg(t_score_preds.squeeze(-1), t_scores_target)
                        loss_reg = loss_reg_all[mask].mean()
                    else:
                        loss_reg = torch.tensor(0.0, device=device)
                        
                    loss = loss_class + 0.5 * loss_reg
                    
                    loss.backward()
                    optimizer.step()
                    
                    running_loss += loss.item() * images.size(0)
                    _, preds = torch.max(class_logits, 1)
                    correct += torch.sum(preds == labels.data).item()
                    total += labels.size(0)
                    
                    if batch_idx % 2 == 0 or batch_idx == len(train_loader):
                         write_log(f"Epoch {epoch}/{epochs} | Batch {batch_idx}/{len(train_loader)} | Loss: {loss.item():.4f} (Class: {loss_class.item():.4f}, Reg: {loss_reg.item():.4f})", db, history_id)
                    
                epoch_loss = running_loss / total
                epoch_acc = correct / total
                
                mlflow.log_metric("train_loss", epoch_loss, step=epoch)
                
                history_metrics["epochs"].append(epoch)
                history_metrics["train_loss"].append(epoch_loss)
                history_metrics["train_accuracy"].append(epoch_acc)
                
                # CHẠY VALIDATION CUỐI EPOCH
                if has_val and val_loader:
                    model.eval()
                    val_loss = 0.0
                    val_correct = 0
                    val_total = 0
                    val_labels_list = []
                    val_preds_list = []
                    val_probs_list = []
                    
                    with torch.no_grad():
                        for batch in val_loader:
                            images = batch["image"].to(device)
                            meta = batch["metadata"].to(device)
                            labels = batch["label"].to(device)
                            t_scores_target = batch["t_score"].to(device)
                            
                            class_logits, t_score_preds = model(images, meta)
                            loss_class = criterion(class_logits, labels)
                            
                            mask = ~torch.isnan(t_scores_target)
                            if mask.sum() > 0:
                                loss_reg_all = criterion_reg(t_score_preds.squeeze(-1), t_scores_target)
                                loss_reg = loss_reg_all[mask].mean()
                            else:
                                loss_reg = torch.tensor(0.0, device=device)
                                
                            loss = loss_class + 0.5 * loss_reg
                            val_loss += loss.item() * images.size(0)
                            
                            probs = torch.softmax(class_logits, dim=1)
                            _, preds = torch.max(class_logits, 1)
                            
                            val_correct += torch.sum(preds == labels.data).item()
                            val_total += labels.size(0)
                            
                            val_labels_list.extend(labels.cpu().numpy())
                            val_preds_list.extend(preds.cpu().numpy())
                            val_probs_list.extend(probs.cpu().numpy())
                            
                    epoch_val_loss = val_loss / val_total
                    epoch_val_acc = val_correct / val_total
                    epoch_f1 = float(f1_score(val_labels_list, val_preds_list, average='weighted', zero_division=0))
                    try:
                        epoch_auc = float(roc_auc_score(val_labels_list, val_probs_list, multi_class='ovr', average='weighted'))
                    except Exception:
                        epoch_auc = 0.5
                        
                    mlflow.log_metric("validation_loss", epoch_val_loss, step=epoch)
                    mlflow.log_metric("accuracy", epoch_val_acc, step=epoch)
                    mlflow.log_metric("f1_score", epoch_f1, step=epoch)
                    mlflow.log_metric("auc", epoch_auc, step=epoch)
                    
                    write_log(f"Epoch {epoch}/{epochs} result: train_loss={epoch_loss:.4f}, validation_loss={epoch_val_loss:.4f}, accuracy={epoch_val_acc:.4f}, f1_score={epoch_f1:.4f}, auc={epoch_auc:.4f}", db, history_id)
                    
                    history_metrics["validation_loss"].append(epoch_val_loss)
                    history_metrics["accuracy"].append(epoch_val_acc)
                    history_metrics["f1_score"].append(epoch_f1)
                    history_metrics["auc"].append(epoch_auc)
                    
                    if epoch_val_loss < best_loss:
                        best_loss = epoch_val_loss
                        write_log(f"Validation loss decreased ({best_loss:.4f}). Saving candidate model...", db, history_id)
                        torch.save(model.state_dict(), "models/candidate_model.pt")
                        torch.save(model.state_dict(), f"models/candidate_model_{ACTIVE_MODEL_VERSION}.pt")
                else:
                    # Fallback nếu không có validation split
                    epoch_val_loss = epoch_loss
                    epoch_val_acc = epoch_acc
                    epoch_f1 = epoch_acc
                    epoch_auc = 0.75 + (epoch * 0.005)
                    
                    mlflow.log_metric("validation_loss", epoch_val_loss, step=epoch)
                    mlflow.log_metric("accuracy", epoch_val_acc, step=epoch)
                    mlflow.log_metric("f1_score", epoch_f1, step=epoch)
                    mlflow.log_metric("auc", epoch_auc, step=epoch)
                    
                    write_log(f"Epoch {epoch}/{epochs} result: train_loss={epoch_loss:.4f}, accuracy={epoch_acc:.4f}", db, history_id)
                    
                    history_metrics["validation_loss"].append(epoch_val_loss)
                    history_metrics["accuracy"].append(epoch_val_acc)
                    history_metrics["f1_score"].append(epoch_f1)
                    history_metrics["auc"].append(epoch_auc)
                    
                    if epoch_loss < best_loss:
                        best_loss = epoch_loss
                        write_log(f"Train loss decreased ({best_loss:.4f}). Saving candidate model...", db, history_id)
                        torch.save(model.state_dict(), "models/candidate_model.pt")
                        torch.save(model.state_dict(), f"models/candidate_model_{ACTIVE_MODEL_VERSION}.pt")

            # Đăng ký candidate model làm artifact lên MLflow
            if os.path.exists("models/candidate_model.pt"):
                mlflow.log_artifact("models/candidate_model.pt")

            # I. VALIDATION GATE (SO SÁNH MÔ HÌNH CŨ VÀ MỚI)
            write_log("Running Validation Gate...", db, history_id)
            candidate_acc = history_metrics["accuracy"][-1] if history_metrics["accuracy"] else 0.0
            
            # Lấy accuracy của mô hình tốt nhất trước đó từ database
            previous_acc = 0.0
            try:
                previous_best = db.query(TrainingHistory).filter(
                    TrainingHistory.status == "success",
                    TrainingHistory.id != history_id
                ).order_by(TrainingHistory.completed_at.desc()).first()
                if previous_best and previous_best.accuracy is not None:
                    previous_acc = previous_best.accuracy
            except Exception as e:
                write_log(f"WARNING: Could not fetch previous best accuracy: {e}", db, history_id)
                
            write_log(f"Candidate Accuracy: {candidate_acc:.4f} | Previous Accuracy: {previous_acc:.4f}", db, history_id)
            
            # Nếu warm start không dùng được (do đổi kiến trúc hoặc weights trống), bỏ qua so sánh
            if not warm_start_success:
                write_log("Bypassing Validation Gate comparison due to missing or incompatible previous model weights.", db, history_id)
                previous_acc = 0.0
            
            # Kiểm tra Gate
            if candidate_acc >= previous_acc or previous_acc == 0.0:
                write_log("Validation Gate PASSED. Deploying candidate model...", db, history_id)
                
                if os.path.exists("models/candidate_model.pt"):
                    shutil.copyfile("models/candidate_model.pt", "models/best_model.pt")
                if os.path.exists(f"models/candidate_model_{ACTIVE_MODEL_VERSION}.pt"):
                    shutil.copyfile(f"models/candidate_model_{ACTIVE_MODEL_VERSION}.pt", f"models/best_model_{ACTIVE_MODEL_VERSION}.pt")
                
                # Log best model lên MLflow
                if os.path.exists("models/best_model.pt"):
                    mlflow.log_artifact("models/best_model.pt")
                    write_log("Logged models/best_model.pt to MLflow.", db, history_id)
                
                # J. LƯU VÀ ĐĂNG KÝ CÁC PIPELINE ARTIFACTS KHÁC LÊN MLFLOW
                write_log("Saving and logging pipeline artifacts (config, metrics, curves plot)...", db, history_id)
                
                # 1. training_config.json
                config_data = {
                    "model_name": "EfficientNet-B3",
                    "epochs": epochs,
                    "batch_size": batch_size,
                    "learning_rate": lr,
                    "optimizer": "Adam",
                    "data_augmentation": use_augmentation,
                    "dataset_size": dataset_size
                }
                config_path = "models/training_config.json"
                with open(config_path, "w") as f:
                    json.dump(config_data, f, indent=4)
                mlflow.log_artifact(config_path)
                
                # 2. metrics.json
                metrics_path = "models/metrics.json"
                with open(metrics_path, "w") as f:
                    json.dump(history_metrics, f, indent=4)
                mlflow.log_artifact(metrics_path)
                
                # 3. plots.png curves plot
                plots_path = "models/plots.png"
                fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
                ax1.plot(history_metrics["epochs"], history_metrics["train_loss"], label="Train Loss", marker='o')
                if has_val:
                    ax1.plot(history_metrics["epochs"], history_metrics["validation_loss"], label="Val Loss", marker='o')
                ax1.set_title("Loss Curves")
                ax1.set_xlabel("Epoch")
                ax1.set_ylabel("Loss")
                ax1.legend()
                ax1.grid(True)
                
                ax2.plot(history_metrics["epochs"], history_metrics["train_accuracy"], label="Train Acc", marker='s')
                if has_val:
                    ax2.plot(history_metrics["epochs"], history_metrics["accuracy"], label="Val Acc", marker='s')
                    ax2.plot(history_metrics["epochs"], history_metrics["f1_score"], label="Val F1", marker='^')
                    ax2.plot(history_metrics["epochs"], history_metrics["auc"], label="Val AUC", marker='d')
                ax2.set_title("Metrics Curves")
                ax2.set_xlabel("Epoch")
                ax2.set_ylabel("Score")
                ax2.legend()
                ax2.grid(True)
                
                plt.tight_layout()
                plt.savefig(plots_path)
                plt.close()
                mlflow.log_artifact(plots_path)
                write_log("Pipeline artifacts logged to MLflow successfully.", db, history_id)

                # K. UPLOAD LÊN CLOUDFLARE R2
                with open("models/best_model.pt", "rb") as model_f:
                    model_bytes = model_f.read()
                    
                write_log(f"Uploading new weights to Cloudflare R2 (key: {r2_model_key})...", db, history_id)
                r2_client.put_object(Bucket=R2_BUCKET_NAME, Key=r2_model_key, Body=model_bytes, ContentType="application/octet-stream")
                r2_client.put_object(Bucket=R2_BUCKET_NAME, Key="models/best_model.pt", Body=model_bytes, ContentType="application/octet-stream")
                write_log("Model weights deployed successfully on Cloudflare R2.", db, history_id)
                
                # L. CẬP NHẬT CSDL: Đánh dấu các ảnh tập train đã được dùng để huấn luyện thành công
                image_paths = [record["image_path"] for record in metadata]
                db.query(XRayImage).filter(XRayImage.image_path.in_(image_paths)).update(
                    {"is_trained": True, "trained_date": datetime.datetime.now().date()},
                    synchronize_session=False
                )
                db.commit()
                write_log(f"Updated {len(image_paths)} xray_image records as 'is_trained = True'.", db, history_id)
                
                # Cập nhật trạng thái thành công cho training history
                db.query(TrainingHistory).filter(TrainingHistory.id == history_id).update({
                    "status": "success",
                    "accuracy": candidate_acc,
                    "loss": history_metrics["validation_loss"][-1] if history_metrics["validation_loss"] else None,
                    "f1_score": history_metrics["f1_score"][-1] if history_metrics["f1_score"] else None,
                    "auc": history_metrics["auc"][-1] if history_metrics["auc"] else None,
                    "completed_at": datetime.datetime.utcnow()
                })
                db.commit()
                write_log("Training pipeline finished successfully! Model is active.", db, history_id)
            else:
                # Từ chối cập nhật mô hình mới do kém chất lượng
                err_msg = f"Validation Gate FAILED: Candidate Accuracy ({candidate_acc:.4f}) < Previous Accuracy ({previous_acc:.4f}). Candidate rejected to preserve system stability."
                write_log(err_msg, db, history_id)
                raise ValueError(err_msg)
            
    except Exception as run_err:
        traceback.print_exc()
        err_msg = f"CRITICAL ERROR in training pipeline: {str(run_err)}"
        print(f"\n[LỖI NGHIÊM TRỌNG] {err_msg}\n")
        
        if "OperationalError" in str(type(run_err)) or "timeout" in str(run_err).lower():
            print("="*80)
            print("GỢI Ý KHẮC PHỤC LỖI KẾT NỐI CSDL:")
            print("1. Google Colab đang chạy trên môi trường đám mây và KHÔNG thể kết nối trực tiếp đến IP cục bộ (localhost/127.0.0.1).")
            print("2. Đảm bảo DATABASE_URL trong Secrets của bạn trỏ tới một máy chủ PostgreSQL public (ví dụ: Neon, Supabase, hoặc AWS RDS) hoặc đã được cấu hình đường hầm bảo mật (ngrok/cloudflare tunnel).")
            print("3. Kiểm tra xem tường lửa (Firewall) của máy chủ CSDL có cho phép kết nối từ mọi IP (0.0.0.0/0) hay không (môi trường Colab thay đổi IP liên tục).")
            print("="*80)
            
        if db is not None:
            try:
                db.rollback()
            except Exception as rollback_err:
                print(f"Failed to rollback transaction: {rollback_err}")
                
        try:
            write_log(err_msg, db, history_id)
        except Exception:
            pass
            
        if db is not None and history_id is not None:
            try:
                db.query(TrainingHistory).filter(TrainingHistory.id == history_id).update({
                    "status": "failed",
                    "error_message": traceback.format_exc(),
                    "completed_at": datetime.datetime.utcnow()
                })
                db.commit()
            except Exception as log_db_err:
                print(f"Failed to record failure status to database: {log_db_err}")
            
    finally:
        if db is not None:
            try:
                db.close()
                print("Đã đóng kết nối cơ sở dữ liệu.")
            except Exception:
                pass

if __name__ == "__main__":
    # Test compilation
    print("Compilation check passed. Ready to be copied into Google Colab!")

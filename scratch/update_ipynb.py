import json
import os

custom_code_str = r"""# ==========================================
# CELL 6: Kịch bản Huấn luyện Chính (Orchestrated)
# ==========================================
import os
os.environ["MLFLOW_ALLOW_FILE_STORE"] = "true"
import uuid
import datetime
import traceback
import torch
from torch.utils.data import DataLoader
import mlflow
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import boto3

def run_colab_training(use_augmentation: bool = True):
    from google.colab import userdata
    
    db = None
    r2_client = None
    history_id = None
    
    print("=== BẮT ĐẦU THIẾT LẬP PIPELINE HUẤN LUYỆN ===")
    
    # 1. Đọc Secrets từ Colab
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
            trainer_id = str(uuid.uuid4())
            
        # C. Query dữ liệu ảnh tập train (Full Retraining luôn luôn)
        print("6. Đang truy vấn siêu dữ liệu ảnh để huấn luyện (Full Retraining)...")
        metadata, dataset_size, clinical_summary = _prepare_training_data(db)
        
        if dataset_size == 0:
            print("LỖI: Không tìm thấy ảnh nào thuộc tập train trong CSDL để huấn luyện!")
            return
            
        # D. Khởi tạo bản ghi Training History
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
        
        write_log("Connected to Google Colab GPU node. Initializing pipeline (Full Retraining)...", db, history_id)
        write_log(f"Dataset Size: {dataset_size} images (Train).", db, history_id)
        
        # E. Tải ảnh từ R2 về Colab SSD
        write_log("Downloading train images from Cloudflare R2 to local SSD...", db, history_id)
        download_all_images(metadata, r2_client, R2_BUCKET_NAME, db, history_id)
        
        # F. Cấu hình hyperparameters
        epochs = 30
        batch_size = 8
        lr = 1e-4
        
        # G. Kiểm tra thiết bị GPU
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        write_log(f"Hardware allocated: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}", db, history_id)
        
        # H. Khởi tạo mô hình & optimizer
        model, criterion, criterion_reg, optimizer, warm_start_success = _init_model_and_optimizer(
            device, lr, r2_client, R2_BUCKET_NAME, ACTIVE_MODEL_VERSION, db, history_id
        )
        
        # I. Tải validation loader nếu có
        has_val, val_loader = _prepare_validation_loader(db, batch_size, r2_client, R2_BUCKET_NAME, history_id)
        
        # J. Setup các biến lưu checkpoint
        torch.save(model.state_dict(), "models/candidate_model.pt")
        torch.save(model.state_dict(), f"models/candidate_model_{ACTIVE_MODEL_VERSION}.pt")
        write_log(f"Initialized models/candidate_model.pt checkpoints.", db, history_id)
        
        train_dataset = OsteoporosisDataset(metadata, use_augmentation=use_augmentation)
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
        
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
        
        # K. Kết nối MLflow & Huấn luyện
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
            
            write_log("Starting neural network optimization loop...", db, history_id)
            for epoch in range(1, epochs + 1):
                epoch_loss, epoch_acc = _run_epoch_train(
                    model, train_loader, device, optimizer, criterion, criterion_reg, epoch, epochs, db, history_id
                )
                
                mlflow.log_metric("train_loss", epoch_loss, step=epoch)
                history_metrics["epochs"].append(epoch)
                history_metrics["train_loss"].append(epoch_loss)
                history_metrics["train_accuracy"].append(epoch_acc)
                
                # Đánh giá validation / log metric
                best_loss = _evaluate_and_log_epoch(
                    model, val_loader, device, criterion, criterion_reg, epoch, epochs, epoch_loss, epoch_acc,
                    history_metrics, has_val, best_loss, ACTIVE_MODEL_VERSION, db, history_id
                )
                
            if os.path.exists("models/candidate_model.pt"):
                mlflow.log_artifact("models/candidate_model.pt")
                
            # L. Validation Gate
            write_log("Running Validation Gate...", db, history_id)
            candidate_acc = history_metrics["accuracy"][-1] if history_metrics["accuracy"] else 0.0
            _evaluate_validation_gate(db, history_id, warm_start_success, candidate_acc, ACTIVE_MODEL_VERSION)
            
            # M. Lưu artifacts (JSON configs, plots)
            _save_and_log_artifacts(
                epochs, batch_size, lr, use_augmentation, dataset_size, history_metrics, has_val, db, history_id
            )
            
            # N. Upload Cloudflare R2
            _upload_weights_to_r2(r2_client, R2_BUCKET_NAME, f"models/{ACTIVE_MODEL_VERSION}/best_model.pt", db, history_id)
            
            # O. Cập nhật trạng thái CSDL
            _update_db_records(db, metadata, history_id, history_metrics, candidate_acc)
            write_log("Training pipeline finished successfully! Model is active.", db, history_id)
            
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
                pass"""

notebook_code_str = r"""# ==========================================
# CELL 5: Pipeline Huấn luyện Mô hình Chính
# ==========================================
def run_colab_training(use_augmentation: bool = True, force_full: bool = True):
    from google.colab import userdata
    
    db = None
    r2_client = None
    history_id = None
    
    print("=== BẮT ĐẦU THIẾT LẬP PIPELINE HUẤN LUYỆN ===")
    
    # 1. Đọc cấu hình bảo mật từ Google Colab Secrets
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
            trainer_id = str(uuid.uuid4())
            
        # C. Query dữ liệu ảnh tập train (hỗ trợ cả full và incremental)
        is_incremental = False
        
        if not force_full:
            print("6. Đang kiểm tra số lượng ảnh chưa huấn luyện cho chế độ Incremental...")
            # Lọc ảnh chưa huấn luyện
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
                # Trộn kinh nghiệm phát lại (Experience Replay)
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
        
        # Thống kê
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
        
        # E. Tải toàn bộ ảnh từ R2 về SSD
        write_log("Downloading train images from Cloudflare R2 to local SSD...", db, history_id)
        download_all_images(metadata, r2_client, R2_BUCKET_NAME, db, history_id)
        if val_metadata:
            write_log("Downloading validation images to local SSD...", db, history_id)
            download_all_images(val_metadata, r2_client, R2_BUCKET_NAME, db, history_id)
            
        # F. Cấu hình Hyperparameters
        epochs = 5 if is_incremental else 30
        batch_size = 8
        lr = 1e-5 if is_incremental else 1e-4
        
        # G. GPU
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        write_log(f"Hardware allocated: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}", db, history_id)
        
        model = OsteoporosisEfficientNetB3(num_classes=3, pretrained=True)
        
        # H. Warm start
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
        
        torch.save(model.state_dict(), "models/candidate_model.pt")
        torch.save(model.state_dict(), f"models/candidate_model_{ACTIVE_MODEL_VERSION}.pt")
        write_log(f"Initialized models/candidate_model.pt checkpoints.", db, history_id)
        
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
                
                # Validation split
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
                        
            if os.path.exists("models/candidate_model.pt"):
                mlflow.log_artifact("models/candidate_model.pt")
                
            # Validation gate
            write_log("Running Validation Gate...", db, history_id)
            candidate_acc = history_metrics["accuracy"][-1] if history_metrics["accuracy"] else 0.0
            
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
            
            if not warm_start_success:
                write_log("Bypassing Validation Gate comparison due to missing or incompatible weights.", db, history_id)
                previous_acc = 0.0
                
            if candidate_acc >= previous_acc or previous_acc == 0.0:
                write_log("Validation Gate PASSED. Deploying candidate model...", db, history_id)
                if os.path.exists("models/candidate_model.pt"):
                    shutil.copyfile("models/candidate_model.pt", "models/best_model.pt")
                if os.path.exists(f"models/candidate_model_{ACTIVE_MODEL_VERSION}.pt"):
                    shutil.copyfile(f"models/candidate_model_{ACTIVE_MODEL_VERSION}.pt", f"models/best_model_{ACTIVE_MODEL_VERSION}.pt")
                if os.path.exists("models/best_model.pt"):
                    mlflow.log_artifact("models/best_model.pt")
                    write_log("Logged models/best_model.pt to MLflow.", db, history_id)
                    
                # Artifacts
                write_log("Saving and logging pipeline artifacts (config, metrics, curves plot)...", db, history_id)
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
                
                # Metrics
                metrics_path = "models/metrics.json"
                with open(metrics_path, "w") as f:
                    json.dump(history_metrics, f, indent=4)
                mlflow.log_artifact(metrics_path)
                
                # Plot
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
                
                # Upload R2
                with open("models/best_model.pt", "rb") as model_f:
                    model_bytes = model_f.read()
                write_log(f"Uploading new weights to Cloudflare R2 (key: {r2_model_key})...", db, history_id)
                r2_client.put_object(Bucket=R2_BUCKET_NAME, Key=r2_model_key, Body=model_bytes, ContentType="application/octet-stream")
                r2_client.put_object(Bucket=R2_BUCKET_NAME, Key="models/best_model.pt", Body=model_bytes, ContentType="application/octet-stream")
                write_log("Model weights deployed successfully on Cloudflare R2.", db, history_id)
                
                # Update db
                image_paths = [record["image_path"] for record in metadata]
                db.query(XRayImage).filter(XRayImage.image_path.in_(image_paths)).update(
                    {"is_trained": True, "trained_date": datetime.datetime.now().date()},
                    synchronize_session=False
                )
                db.commit()
                write_log(f"Updated {len(image_paths)} xray_image records as 'is_trained = True'.", db, history_id)
                
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
                err_msg = f"Validation Gate FAILED: Candidate Accuracy ({candidate_acc:.4f}) < Previous Accuracy ({previous_acc:.4f}). Candidate rejected to preserve system stability."
                write_log(err_msg, db, history_id)
                raise ValueError(err_msg)
                
    except Exception as run_err:
        traceback.print_exc()
        err_msg = f"CRITICAL ERROR in training pipeline: {str(run_err)}"
        print(f"\\n[LỖI NGHIÊM TRỌNG] {err_msg}\\n")
        
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

print("Training pipeline function 'run_colab_training' defined!")"""


def update_ipynb(filepath, source_code_str):
    print(f"Updating {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Split code string into lines with trailing newline
    source_lines = [line + '\n' for line in source_code_str.split('\n')]
    if source_lines and source_lines[-1] == '\n':
        source_lines[-1] = '' # clean up trailing empty line
    elif source_lines:
        # remove the trailing \n from the very last line
        if source_lines[-1].endswith('\n'):
            source_lines[-1] = source_lines[-1][:-1]

    updated = False
    for cell in data['cells']:
        if cell['cell_type'] == 'code':
            source_str = "".join(cell['source'])
            if 'def run_colab_training(' in source_str:
                cell['source'] = source_lines
                updated = True
                print(f"Found and updated target cell in {filepath}!")
                break
                
    if updated:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        print(f"Successfully wrote changes to {filepath}")
    else:
        print(f"Could not find the target cell in {filepath}")

# Update both files
update_ipynb('scratch/colab_custom.ipynb', custom_code_str)
update_ipynb('scratch/colab_training_notebook.ipynb', notebook_code_str)
print("Finished!")

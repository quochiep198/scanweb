import os
import sys
import json
import uuid
import time
import logging
from datetime import datetime
import subprocess

from sqlalchemy.orm import Session
from app.models.xray_image import XRayImage
from app.models.training_history import TrainingHistory
from app.models.training_log import TrainingLog
from app.core.config import settings

logger = logging.getLogger(__name__)

class KaggleService:
    @staticmethod
    def write_log(message: str, db: Session = None, run_id: str = None, mode: str = "a"):
        BASE_DIR = "/data" if os.path.isdir("/data") and os.access("/data", os.W_OK) else "."
        model_dir = os.path.join(BASE_DIR, "models")
        log_file_path = os.path.join(model_dir, "training.log")
        
        os.makedirs(model_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(log_file_path, mode, encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")

        if db is not None and run_id is not None:
            try:
                log_entry = TrainingLog(run_id=run_id, message=message)
                db.add(log_entry)
                db.commit()
            except Exception as e:
                logger.error(f"Failed to write log to DB: {e}")

    @staticmethod
    def perform_dataset_split(db: Session):
        """
        Quets all xray_images where trained_date IS NULL.
        Shuffles them and splits them 85% train and 15% validation.
        """
        KaggleService.write_log("Đang phân tích dữ liệu mới chưa huấn luyện...", db)
        untrained_images = db.query(XRayImage).filter(XRayImage.trained_date == None).all()
        
        if not untrained_images:
            KaggleService.write_log("Không phát hiện ảnh mới nào cần phân chia dataset.", db)
            return len(untrained_images)

        import random
        random.shuffle(untrained_images)
        total = len(untrained_images)
        train_size = int(total * 0.85)

        KaggleService.write_log(f"Phân chia {total} ảnh mới: 85% ({train_size}) làm Train, 15% ({total - train_size}) làm Validation.", db)
        
        for i, img in enumerate(untrained_images):
            if i < train_size:
                img.dataset_split = "train"
            else:
                img.dataset_split = "validation"
                
        db.commit()
        KaggleService.write_log("Đã cập nhật phân chia tập dữ liệu thành công trong CSDL.", db)
        return total

    @staticmethod
    def run_kaggle_training_pipeline(
        db: Session, 
        trainer_id: str, 
        history_id: str, 
        epochs: int = 50, 
        use_augmentation: bool = True,
        kaggle_username: str = None, 
        kaggle_key: str = None,
        warm_up: bool = True
    ):
        # Setup credentials
        username = kaggle_username or settings.KAGGLE_USERNAME
        key = kaggle_key or settings.KAGGLE_KEY
        
        # Monkey-patch write_log to write to both DB and local file
        old_write_log = KaggleService.write_log
        def temp_write_log(message: str, *args, **kwargs):
            mode = kwargs.get("mode", "a")
            if len(args) >= 3:
                mode = args[2]
            old_write_log(message, db, history_id, mode)
        KaggleService.write_log = temp_write_log

        try:
            KaggleService.write_log("Bắt đầu chuẩn bị cấu hình huấn luyện qua Kaggle GPU Cloud...", "w")
            
            # Step 1: Perform dataset split on new/untrained images
            KaggleService.perform_dataset_split(db)

            # Count total training dataset size
            untrained_count = db.query(XRayImage).filter(XRayImage.trained_date == None).count()
            existing_train_count = db.query(XRayImage).filter(XRayImage.dataset_split == "train", XRayImage.trained_date != None).count()
            total_train_size = existing_train_count + int(untrained_count * 0.85)

            if total_train_size == 0:
                raise ValueError("Không có dữ liệu mới để huấn luyện.")

            computed_batch_size = 32 if total_train_size > 128 else 16
            batch_size = min(computed_batch_size, total_train_size)
            batch_size = max(1, batch_size)
            
            # Linear scaling rule
            learning_rate = 1e-4 * (batch_size / 16.0)
            learning_rate = max(1e-5, min(learning_rate, 3e-4))

            # Step 2: Read notebook template (with fallbacks for Docker container)
            current_file_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Path 1: Inside services directory (production container)
            notebook_template_path = os.path.abspath(os.path.join(current_file_dir, "traning-osteo.ipynb"))
            
            # Fallback path 2: Local development folder structure
            if not os.path.exists(notebook_template_path):
                notebook_template_path = os.path.abspath(
                    os.path.join(current_file_dir, "..", "..", "..", "scriptTranining", "traning-osteo.ipynb")
                )
            
            if not os.path.exists(notebook_template_path):
                raise FileNotFoundError(f"Không tìm thấy tệp mẫu notebook tại {notebook_template_path}")

            temp_dir = os.path.abspath(os.path.join(current_file_dir, "..", "..", "tmp", "kaggle_jobs", history_id))
            os.makedirs(temp_dir, exist_ok=True)
            kaggle_nb_path = os.path.join(temp_dir, "kaggle_custom.ipynb")
            metadata_path = os.path.join(temp_dir, "kernel-metadata.json")

            KaggleService.write_log("Đang chuyển đổi và cấu hình tệp Jupyter Notebook cho Kaggle...")
            with open(notebook_template_path, "r", encoding="utf-8") as f:
                nb = json.load(f)

            # Inject Kaggle accelerator metadata
            if "metadata" not in nb:
                nb["metadata"] = {}
            if "kaggle" not in nb["metadata"]:
                nb["metadata"]["kaggle"] = {}
            nb["metadata"]["kaggle"]["accelerator"] = "nvidiaTeslaT4"

            # Parse and replace hyperparameters, secrets and credentials in the notebook cells
            for cell in nb.get("cells", []):
                if cell.get("cell_type") == "code":
                    new_source = []
                    source = cell.get("source", [])
                    # Support both list and string types of source
                    lines = source if isinstance(source, list) else source.splitlines(keepends=True)
                    
                    for line in lines:
                        # Comment out secrets modules imports
                        line = line.replace("from google.colab import userdata", "# from google.colab import userdata")
                        line = line.replace("from kaggle_secrets import UserSecretsClient", "# from kaggle_secrets import UserSecretsClient")
                        
                        # Prevent upgrading pre-installed torch/torchvision which breaks CUDA compatibility
                        if "pip install" in line and "easyocr" in line:
                            line = "!pip install --no-deps easyocr torchxrayvision monai && pip install python-bidi pyclipper pydicom psycopg2-binary mlflow\n"
                        
                        # Inject actual configuration settings values directly to bypass manual secret configuration on Kaggle website
                        # Handle Colab userdata.get (single quotes)
                        line = line.replace("userdata.get('DATABASE_URL')", f"'{settings.DATABASE_URL}'")
                        line = line.replace("userdata.get('CLOUDFLARE_R2_ACCOUNT_ID')", f"'{settings.CLOUDFLARE_R2_ACCOUNT_ID}'")
                        line = line.replace("userdata.get('CLOUDFLARE_R2_ACCESS_KEY_ID')", f"'{settings.CLOUDFLARE_R2_ACCESS_KEY_ID}'")
                        line = line.replace("userdata.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY')", f"'{settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY}'")
                        line = line.replace("userdata.get('CLOUDFLARE_R2_BUCKET_NAME')", f"'{settings.CLOUDFLARE_R2_BUCKET_NAME}'")
                        line = line.replace("userdata.get('ACTIVE_MODEL_VERSION')", f"'{settings.ACTIVE_MODEL_VERSION}'")
                        
                        # Handle Colab userdata.get (double quotes)
                        line = line.replace('userdata.get("DATABASE_URL")', f"'{settings.DATABASE_URL}'")
                        line = line.replace('userdata.get("CLOUDFLARE_R2_ACCOUNT_ID")', f"'{settings.CLOUDFLARE_R2_ACCOUNT_ID}'")
                        line = line.replace('userdata.get("CLOUDFLARE_R2_ACCESS_KEY_ID")', f"'{settings.CLOUDFLARE_R2_ACCESS_KEY_ID}'")
                        line = line.replace('userdata.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")', f"'{settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY}'")
                        line = line.replace('userdata.get("CLOUDFLARE_R2_BUCKET_NAME")', f"'{settings.CLOUDFLARE_R2_BUCKET_NAME}'")
                        line = line.replace('userdata.get("ACTIVE_MODEL_VERSION")', f"'{settings.ACTIVE_MODEL_VERSION}'")

                        # Handle Kaggle UserSecretsClient().get_secret (single quotes)
                        line = line.replace("UserSecretsClient().get_secret('DATABASE_URL')", f"'{settings.DATABASE_URL}'")
                        line = line.replace("UserSecretsClient().get_secret('CLOUDFLARE_R2_ACCOUNT_ID')", f"'{settings.CLOUDFLARE_R2_ACCOUNT_ID}'")
                        line = line.replace("UserSecretsClient().get_secret('CLOUDFLARE_R2_ACCESS_KEY_ID')", f"'{settings.CLOUDFLARE_R2_ACCESS_KEY_ID}'")
                        line = line.replace("UserSecretsClient().get_secret('CLOUDFLARE_R2_SECRET_ACCESS_KEY')", f"'{settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY}'")
                        line = line.replace("UserSecretsClient().get_secret('CLOUDFLARE_R2_BUCKET_NAME')", f"'{settings.CLOUDFLARE_R2_BUCKET_NAME}'")
                        line = line.replace("UserSecretsClient().get_secret('ACTIVE_MODEL_VERSION')", f"'{settings.ACTIVE_MODEL_VERSION}'")
                        
                        # Handle Kaggle UserSecretsClient().get_secret (double quotes)
                        line = line.replace('UserSecretsClient().get_secret("DATABASE_URL")', f"'{settings.DATABASE_URL}'")
                        line = line.replace('UserSecretsClient().get_secret("CLOUDFLARE_R2_ACCOUNT_ID")', f"'{settings.CLOUDFLARE_R2_ACCOUNT_ID}'")
                        line = line.replace('UserSecretsClient().get_secret("CLOUDFLARE_R2_ACCESS_KEY_ID")', f"'{settings.CLOUDFLARE_R2_ACCESS_KEY_ID}'")
                        line = line.replace('UserSecretsClient().get_secret("CLOUDFLARE_R2_SECRET_ACCESS_KEY")', f"'{settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY}'")
                        line = line.replace('UserSecretsClient().get_secret("CLOUDFLARE_R2_BUCKET_NAME")', f"'{settings.CLOUDFLARE_R2_BUCKET_NAME}'")
                        line = line.replace('UserSecretsClient().get_secret("ACTIVE_MODEL_VERSION")', f"'{settings.ACTIVE_MODEL_VERSION}'")
                        
                        # Handle general os.environ get (single quotes)
                        line = line.replace("os.environ.get('DATABASE_URL')", f"'{settings.DATABASE_URL}'")
                        line = line.replace("os.environ.get('CLOUDFLARE_R2_ACCOUNT_ID')", f"'{settings.CLOUDFLARE_R2_ACCOUNT_ID}'")
                        line = line.replace("os.environ.get('CLOUDFLARE_R2_ACCESS_KEY_ID')", f"'{settings.CLOUDFLARE_R2_ACCESS_KEY_ID}'")
                        line = line.replace("os.environ.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY')", f"'{settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY}'")
                        line = line.replace("os.environ.get('CLOUDFLARE_R2_BUCKET_NAME')", f"'{settings.CLOUDFLARE_R2_BUCKET_NAME}'")
                        line = line.replace("os.environ.get('ACTIVE_MODEL_VERSION')", f"'{settings.ACTIVE_MODEL_VERSION}'")

                        # Handle general os.environ get (double quotes)
                        line = line.replace('os.environ.get("DATABASE_URL")', f"'{settings.DATABASE_URL}'")
                        line = line.replace('os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID")', f"'{settings.CLOUDFLARE_R2_ACCOUNT_ID}'")
                        line = line.replace('os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")', f"'{settings.CLOUDFLARE_R2_ACCESS_KEY_ID}'")
                        line = line.replace('os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")', f"'{settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY}'")
                        line = line.replace('os.environ.get("CLOUDFLARE_R2_BUCKET_NAME")', f"'{settings.CLOUDFLARE_R2_BUCKET_NAME}'")
                        line = line.replace('os.environ.get("ACTIVE_MODEL_VERSION")', f"'{settings.ACTIVE_MODEL_VERSION}'")

                        # Replace history_id and trainer_id to synchronize running state
                        line = line.replace("history_id = str(uuid.uuid4())", f"history_id = '{history_id}'")
                        line = line.replace('trainer_id = db.execute(text("SELECT id FROM users LIMIT 1")).scalar()', f"trainer_id = '{trainer_id}'")
                        line = line.replace("trainer_id = db.execute(text('SELECT id FROM users LIMIT 1')).scalar()", f"trainer_id = '{trainer_id}'")

                        # Replace hyperparameters
                        line = line.replace("epochs = 50", f"epochs = {epochs}")
                        line = line.replace("batch_size = 8", f"batch_size = {batch_size}")
                        line = line.replace("lr = 1e-4", f"lr = {learning_rate}")
                        
                        # Replace bypass_warm_start
                        bypass_warm_start_val = "False" if warm_up else "True"
                        line = line.replace("bypass_warm_start = False", f"bypass_warm_start = {bypass_warm_start_val}")

                        # Replace execution script call at the end
                        if "run_kaggle_training(" in line and "def " not in line:
                            line = f"run_kaggle_training(use_augmentation={use_augmentation})\n"

                        new_source.append(line)
                    cell["source"] = new_source

            with open(kaggle_nb_path, "w", encoding="utf-8") as f:
                json.dump(nb, f, indent=2)

            # Step 3: Create kernel-metadata.json
            slug = "osteoai-training-job"
            metadata = {
                "id": f"{username}/{slug}",
                "title": "OsteoAI Training Job",
                "code_file": "kaggle_custom.ipynb",
                "language": "python",
                "kernel_type": "notebook",
                "is_private": True,
                "enable_gpu": True,
                "accelerator": "NvidiaTeslaT4",
                "enable_tpu": False,
                "enable_internet": True,
                "dataset_sources": [],
                "competition_sources": [],
                "kernel_sources": [],
                "model_sources": []
            }
            with open(metadata_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2)

            # Step 4: Push to Kaggle CLI
            KaggleService.write_log(f"Đang kết nối API và đẩy notebook lên Kaggle cho tài khoản '{username}'...")
            
            # Setup environment variables for Kaggle API
            os.environ["KAGGLE_USERNAME"] = username
            os.environ["KAGGLE_KEY"] = key
            os.environ["KAGGLE_API_TOKEN"] = key
            
            # pyrefly: ignore [missing-import]
            from kaggle.api.kaggle_api_extended import KaggleApi
            api = KaggleApi()
            api.authenticate()
            
            # Execute kernels push with NvidiaTeslaT4 accelerator
            push_cmd = ["kaggle", "kernels", "push", "-p", temp_dir, "--accelerator", "NvidiaTeslaT4"]
            logger.info(f"Executing Kaggle push command: {' '.join(push_cmd)}")
            res = subprocess.run(push_cmd, capture_output=True, text=True, encoding="utf-8")
            
            if res.returncode != 0:
                error_msg = res.stderr or res.stdout or "Không rõ lỗi."
                raise RuntimeError(f"Lỗi khi đẩy Notebook lên Kaggle qua CLI: {error_msg}")
                
            KaggleService.write_log("Đã tải notebook lên Kaggle thành công. Job đang được đưa vào hàng đợi chạy trên GPU...")

            # Step 5: Polling job status
            last_status = None
            max_time = 3600 * 3  # 3 hours timeout limit
            start_time = time.time()
            kernel_ref = f"{username}/{slug}"

            while time.time() - start_time < max_time:
                try:
                    res = api.kernels_status(kernel_ref)
                    status_obj = getattr(res, "status", None) or (res.get("status") if isinstance(res, dict) else None)
                    status_str = str(status_obj) if status_obj is not None else ""
                    
                    if status_str != last_status:
                        KaggleService.write_log(f"Trạng thái tiến trình Kaggle: {status_str}")
                        last_status = status_str

                    status_lower = status_str.lower()
                    if "complete" in status_lower:
                        KaggleService.write_log("Kaggle Kernel hoàn tất thành công! Trọng số mô hình đã được tải lên Cloudflare R2.")
                        
                        # Update status in db
                        db.query(TrainingHistory).filter(TrainingHistory.id == history_id).update({
                            "status": "success",
                            "completed_at": datetime.utcnow()
                        })
                        db.commit()
                        break
                    elif "error" in status_lower:
                        failure_msg = getattr(res, "failure_message", None) or (res.get("failure_message") if isinstance(res, dict) else "Không rõ lỗi chi tiết.")
                        KaggleService.write_log(f"LỖI: Kaggle Kernel chạy thất bại: {failure_msg}")
                        
                        db.query(TrainingHistory).filter(TrainingHistory.id == history_id).update({
                            "status": "failed",
                            "error_message": f"Kaggle execution failed: {failure_msg}",
                            "completed_at": datetime.utcnow()
                        })
                        db.commit()
                        break
                except Exception as poll_err:
                    logger.error(f"Error polling Kaggle status: {poll_err}")
                
                time.sleep(30)
            else:
                # Timeout
                KaggleService.write_log("LỖI: Quá thời gian chờ chạy trên Kaggle GPU (Timeout 3h).")
                db.query(TrainingHistory).filter(TrainingHistory.id == history_id).update({
                    "status": "failed",
                    "error_message": "Kaggle job timed out after 3 hours",
                    "completed_at": datetime.utcnow()
                })
                db.commit()

        except Exception as e:
            KaggleService.write_log(f"LỖI KHỞI CHẠY KAGGLE: {e}")
            db.query(TrainingHistory).filter(TrainingHistory.id == history_id).update({
                "status": "failed",
                "error_message": f"Failed to push or monitor Kaggle job: {str(e)}",
                "completed_at": datetime.utcnow()
            })
            db.commit()
        finally:
            KaggleService.write_log = old_write_log

    @staticmethod
    def run_kaggle_training_pipeline_task(
        trainer_id: str, 
        history_id: str, 
        epochs: int = 50, 
        use_augmentation: bool = True,
        kaggle_username: str = None, 
        kaggle_key: str = None,
        warm_up: bool = True
    ):
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            return KaggleService.run_kaggle_training_pipeline(
                db=db,
                trainer_id=trainer_id,
                history_id=history_id,
                epochs=epochs,
                use_augmentation=use_augmentation,
                kaggle_username=kaggle_username,
                kaggle_key=kaggle_key,
                warm_up=warm_up
            )
        except Exception as e:
            logger.error(f"Kaggle training background task failed: {e}")
            raise e
        finally:
            db.close()

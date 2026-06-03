import os
import torch
import torch.nn as nn
import numpy as np
import logging
import hashlib
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.models.efficientnet_model import OsteoporosisEfficientNetB3
from app.models.measurement_result import MeasurementResult
from app.services.r2_service import R2Service
from app.services.image_loader_service import ImageLoaderService
from app.services.anonymize_service import AnonymizeService
from app.services.xray_analyzer_service import XRayAnalyzerService
from app.services.monai_processing_service import MonaiProcessingService

logger = logging.getLogger(__name__)

# Global cache in memory for PyTorch models keyed by model_version
_cached_models = {}

class MeasureService:
    @staticmethod
    def get_device() -> torch.device:
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")

    @staticmethod
    def load_model() -> OsteoporosisEfficientNetB3:
        """
        Loads the model based on settings.ACTIVE_MODEL_VERSION.
        First checks local folder, then downloads from R2.
        Caches the model instance in memory.
        """
        global _cached_models
        
        version = settings.ACTIVE_MODEL_VERSION
        if version in _cached_models:
            return _cached_models[version]
            
        device = MeasureService.get_device()
        local_path = f"models/best_model_{version}.pt"
        r2_key = f"models/{version}/best_model.pt"
        
        # 1. Check if model exists locally
        if not os.path.exists(local_path):
            logger.info(f"Model {local_path} not found locally. Attempting to download key {r2_key} from Cloudflare R2...")
            try:
                os.makedirs("models", exist_ok=True)
                try:
                    # A. Try downloading the versioned model from R2
                    model_bytes = R2Service.download_file(r2_key)
                except Exception as download_err:
                    logger.info("Download of versioned key failed. Trying to download default models/best_model.pt from R2...")
                    try:
                        # B. Fallback to default models/best_model.pt on R2
                        model_bytes = R2Service.download_file("models/best_model.pt")
                    except Exception as default_r2_err:
                        # C. Fallback to local legacy file if exists
                        if os.path.exists("models/best_model.pt"):
                            logger.info("R2 download failed entirely, but found local models/best_model.pt. Loading local file.")
                            with open("models/best_model.pt", "rb") as legacy_f:
                                model_bytes = legacy_f.read()
                        else:
                            raise default_r2_err

                with open(local_path, "wb") as f:
                    f.write(model_bytes)
                logger.info(f"Successfully downloaded model to {local_path}")
            except Exception as e:
                logger.error(f"Failed to download model from R2: {e}")
                # Secondary fallback to legacy model if it exists
                if os.path.exists("models/best_model.pt"):
                    logger.info("Falling back to local models/best_model.pt as final backup")
                    local_path = "models/best_model.pt"
                else:
                    raise FileNotFoundError(f"Model file {r2_key} could not be loaded and no fallback models/best_model.pt exists: {e}")

        # 2. Instantiate model and load weights
        try:
            logger.info(f"Loading weights from {local_path} to device {device}...")
            model = OsteoporosisEfficientNetB3(num_classes=3, pretrained=False)
            model.load_state_dict(torch.load(local_path, map_location=device))
            model.to(device)
            model.eval()
            _cached_models[version] = model
            logger.info(f"Model version {version} loaded and cached in memory successfully.")
            return model
        except Exception as e:
            logger.error(f"Error loading model state dictionary: {e}")
            raise e

    @staticmethod
    def predict(
        db: Session,
        user_id: str,
        file_content: bytes,
        filename: str,
        age: int,
        sex: str,
        bmi: float
    ) -> dict:
        """
        Processes image and metadata, runs PyTorch model inference,
        saves the result to measurement_results table, and returns predictions.
        Uploads image temporarily to R2.
        """
        try:
            # 0. Anonymize image data (remove metadata and redact burned-in text)
            try:
                file_content = AnonymizeService.anonymize_image(file_content, filename)
            except Exception as e:
                logger.error(f"Failed to anonymize image data during predict flow: {e}")
                raise ValueError(f"Không thể khử thông tin nhạy cảm của ảnh: {str(e)}")

            # 1. Load model (from cache or R2/file)
            model = MeasureService.load_model()
            device = MeasureService.get_device()
            
            # 2. Preprocess image
            # A. Convert bytes to NumPy array
            np_arr = ImageLoaderService.load_image_to_numpy(file_content, filename)
            
            # B. TorchXRayVision preprocessing (grayscale, norm, center crop, resize to 224x224)
            xray_arr = XRayAnalyzerService.preprocess_xray(np_arr)
            
            # C. MONAI preprocessing without random augmentations (resize to 300x300, intensity normalisation, convert to Tensor)
            image_tensor = MonaiProcessingService.process_image(xray_arr, use_augmentation=False)
            
            # Add batch dimension: (1, 1, 300, 300)
            image_tensor = image_tensor.unsqueeze(0).to(device)

            # 3. Preprocess metadata
            # Map gender values: M -> 0.0, F -> 1.0, Other -> 2.0
            sex_val = 2.0
            sex_str = sex.strip().upper() if sex else "OTHER"
            if sex_str == "M":
                sex_val = 0.0
            elif sex_str == "F":
                sex_val = 1.0
                
            metadata_tensor = torch.tensor([[float(age), sex_val, float(bmi)]], dtype=torch.float32).to(device)

            # 4. Run PyTorch inference
            with torch.no_grad():
                logits = model(image_tensor, metadata_tensor)
                probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
                
            # Class mapping: 0 -> normal, 1 -> osteopenia, 2 -> osteoporosis
            labels = ["normal", "osteopenia", "osteoporosis"]
            pred_idx = int(np.argmax(probs))
            predicted_label = labels[pred_idx]
            confidence = float(probs[pred_idx])
            
            normal_prob = float(probs[0])
            osteopenia_prob = float(probs[1])
            osteoporosis_prob = float(probs[2])

            # Label display translations
            translations = {
                "normal": "Bình thường",
                "osteopenia": "Thiếu xương",
                "osteoporosis": "Loãng xương"
            }
            predicted_label_display = translations.get(predicted_label, predicted_label)

            # Calculate SHA256 of file
            sha256_hash = hashlib.sha256(file_content).hexdigest()

            # Upload temporarily to R2 (Solution A) - TTL 24h
            now = datetime.now()
            uuid_str = str(uuid.uuid4())
            ext = filename.split(".")[-1].lower()
            if ext == 'dcm':
                content_type = 'application/dicom'
            elif ext == 'png':
                content_type = 'image/png'
            else:
                content_type = 'image/jpeg'

            temp_key = f"temp_measurements/{now.year}/{now.month:02d}/{now.day:02d}/{uuid_str}_{filename}"
            image_r2_key = R2Service.upload_file(file_content, filename, content_type, custom_key=temp_key)

            # 5. Save history to database
            db_result = MeasurementResult(
                user_id=user_id,
                image_filename=filename,
                image_r2_key=image_r2_key,
                image_sha256_hash=sha256_hash,
                age=age,
                sex=sex_str if sex_str in ("M", "F", "Other") else "Other",
                bmi=bmi,
                predicted_label=predicted_label,
                confidence=confidence,
                normal_probability=normal_prob,
                osteopenia_probability=osteopenia_prob,
                osteoporosis_probability=osteoporosis_prob,
                model_path=f"models/{settings.ACTIVE_MODEL_VERSION}/best_model.pt",
                model_version=settings.ACTIVE_MODEL_VERSION,
                dataset_version=settings.ACTIVE_DATASET_VERSION
            )
            db.add(db_result)
            db.commit()
            db.refresh(db_result)

            return {
                "measurement_id": db_result.measurement_id,
                "predicted_label": predicted_label,
                "predicted_label_display": predicted_label_display,
                "confidence": confidence,
                "probabilities": {
                    "normal": normal_prob,
                    "osteopenia": osteopenia_prob,
                    "osteoporosis": osteoporosis_prob
                },
                "model_name": f"best_model_{settings.ACTIVE_MODEL_VERSION}.pt"
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Inference pipeline execution error: {e}")
            raise e

    @staticmethod
    def confirm_review(
        db: Session,
        measurement_id: int,
        review_status: str,
        doctor_confirmed_label: str,
        error_type: str,
        approved_for_next_training: bool,
        review_note: str,
        reviewer_id: str
    ) -> MeasurementResult:
        """
        Updates measurement result with doctor's review.
        If approved for retraining, copies the image from temporary storage to permanent training storage.
        """
        db_result = db.query(MeasurementResult).filter(MeasurementResult.measurement_id == measurement_id).first()
        if not db_result:
            raise FileNotFoundError(f"Không tìm thấy bản ghi phân tích với ID: {measurement_id}")

        # Validate review status values
        allowed_statuses = ('confirmed_correct', 'corrected_by_doctor', 'rejected', 'uncertain')
        if review_status not in allowed_statuses:
            raise ValueError(f"Trạng thái review không hợp lệ: {review_status}")

        db_result.review_status = review_status
        db_result.doctor_confirmed_label = doctor_confirmed_label
        db_result.error_type = error_type or 'none'
        db_result.approved_for_next_training = approved_for_next_training
        db_result.review_note = review_note
        db_result.reviewed_by = reviewer_id
        db_result.reviewed_at = func.now()

        # Calculate if AI was correct
        if review_status == 'confirmed_correct':
            db_result.is_ai_correct = True
            db_result.doctor_confirmed_label = db_result.predicted_label
        elif review_status == 'corrected_by_doctor':
            db_result.is_ai_correct = (db_result.predicted_label == doctor_confirmed_label)
        elif review_status == 'rejected':
            db_result.is_ai_correct = False
        else:
            db_result.is_ai_correct = None

        # Copy from temp_measurements/ to retraining_dataset/ on R2 if approved for next training
        if approved_for_next_training and db_result.image_r2_key:
            # Check if it's already in retraining_dataset (avoid double copying)
            if "temp_measurements/" in db_result.image_r2_key:
                try:
                    now = datetime.now()
                    filename = db_result.image_filename or "image.png"
                    uuid_str = str(uuid.uuid4())
                    dest_key = f"retraining_dataset/{now.year}/{now.month:02d}/{now.day:02d}/{uuid_str}_{filename}"
                    
                    new_r2_url = R2Service.copy_file(source_key=db_result.image_r2_key, dest_key=dest_key)
                    db_result.image_r2_key = new_r2_url
                    logger.info(f"Image copied to training storage: {new_r2_url}")
                except Exception as e:
                    logger.error(f"Failed to copy image to retraining path in R2: {e}")

        db.commit()
        db.refresh(db_result)
        return db_result

import os
import torch
import torch.nn as nn
import numpy as np
import logging
from sqlalchemy.orm import Session

from app.models.efficientnet_model import OsteoporosisEfficientNetB3
from app.models.measurement_result import MeasurementResult
from app.services.r2_service import R2Service
from app.services.image_loader_service import ImageLoaderService
from app.services.xray_analyzer_service import XRayAnalyzerService
from app.services.monai_processing_service import MonaiProcessingService

logger = logging.getLogger(__name__)

# Global cache in memory for the PyTorch model
_cached_model = None
_cached_model_path = "models/best_model.pt"

class MeasureService:
    @staticmethod
    def get_device() -> torch.device:
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")

    @staticmethod
    def load_model() -> OsteoporosisEfficientNetB3:
        """
        Loads the best_model.pt. First checks local folder, then downloads from R2.
        Caches the model instance in memory.
        """
        global _cached_model
        
        if _cached_model is not None:
            return _cached_model
            
        device = MeasureService.get_device()
        local_path = _cached_model_path
        
        # 1. Check if model exists locally
        if not os.path.exists(local_path):
            logger.info(f"Model {local_path} not found locally. Attempting to download from Cloudflare R2...")
            try:
                os.makedirs("models", exist_ok=True)
                model_bytes = R2Service.download_file("models/best_model.pt")
                with open(local_path, "wb") as f:
                    f.write(model_bytes)
                logger.info(f"Successfully downloaded model to {local_path}")
            except Exception as e:
                logger.error(f"Failed to download model from R2: {e}")
                # If R2 download fails, check if we have a default model or raise error
                raise FileNotFoundError(f"Model file best_model.pt could not be loaded: {e}")

        # 2. Instantiate model and load weights
        try:
            logger.info(f"Loading weights from {local_path} to device {device}...")
            model = OsteoporosisEfficientNetB3(num_classes=3, pretrained=False)
            model.load_state_dict(torch.load(local_path, map_location=device))
            model.to(device)
            model.eval()
            _cached_model = model
            logger.info("Model loaded and cached in memory successfully.")
            return _cached_model
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
        """
        try:
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

            # 5. Save history to database
            db_result = MeasurementResult(
                user_id=user_id,
                image_filename=filename,
                age=age,
                sex=sex_str if sex_str in ("M", "F", "Other") else "Other",
                bmi=bmi,
                predicted_label=predicted_label,
                confidence=confidence,
                normal_probability=normal_prob,
                osteopenia_probability=osteopenia_prob,
                osteoporosis_probability=osteoporosis_prob,
                model_path="best_model.pt"
            )
            db.add(db_result)
            db.commit()
            db.refresh(db_result)

            return {
                "predicted_label": predicted_label,
                "predicted_label_display": predicted_label_display,
                "confidence": confidence,
                "probabilities": {
                    "normal": normal_prob,
                    "osteopenia": osteopenia_prob,
                    "osteoporosis": osteoporosis_prob
                },
                "model_name": "best_model.pt"
            }
        except Exception as e:
            db.rollback()
            logger.error(f"Inference pipeline execution error: {e}")
            raise e

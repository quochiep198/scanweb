import torch
from torch.utils.data import Dataset, DataLoader
from sqlalchemy.orm import Session
from app.models.patient import Patient
from app.models.xray_image import XRayImage
from app.models.osteoporosis_label import OsteoporosisLabel
from app.services.r2_service import R2Service
from app.services.image_loader_service import ImageLoaderService
from app.services.xray_analyzer_service import XRayAnalyzerService
from app.services.monai_processing_service import MonaiProcessingService
import logging

logger = logging.getLogger(__name__)

class OsteoporosisDataset(Dataset):
    def __init__(self, metadata: list, use_augmentation: bool = True):
        """
        PyTorch Dataset for osteoporosis training.
        metadata: List of dicts, each representing a SQL record.
        use_augmentation: Whether to apply random augmentations.
        """
        self.metadata = metadata
        self.use_augmentation = use_augmentation

    def __len__(self):
        return len(self.metadata)

    def __getitem__(self, idx: int):
        record = self.metadata[idx]
        image_path = record["image_path"]
        
        try:
            # 1. Download bytes from R2
            image_bytes = R2Service.download_file(image_path)
            
            # 2. Extract filename
            filename = image_path.split("/")[-1]
            
            # 3. Decode image bytes to NumPy array
            np_arr = ImageLoaderService.load_image_to_numpy(image_bytes, filename)
            
            # 4. TorchXRayVision preprocessing (normalization, center crop, resize to 224x224)
            xray_arr = XRayAnalyzerService.preprocess_xray(np_arr)
            
            # 5. MONAI processing/augmentation (resize to 300x300, intensity normalization, random transforms)
            image_tensor = MonaiProcessingService.process_image(xray_arr, self.use_augmentation)
            
            # 6. Extract clinical features (Age, Sex, BMI)
            age = float(record["age"]) if record["age"] is not None else 0.0
            
            sex_val = 2.0  # Default to 'Other' or None
            if record["sex"] == "M":
                sex_val = 0.0
            elif record["sex"] == "F":
                sex_val = 1.0
                
            bmi = float(record["bmi"]) if record["bmi"] is not None else 0.0
            
            metadata_tensor = torch.tensor([age, sex_val, bmi], dtype=torch.float32)
            
            # 7. Map diagnosis label to integers (0: normal, 1: osteopenia, 2: osteoporosis)
            label_str = str(record["label"]).lower().strip() if record["label"] is not None else "normal"
            label_map = {
                "normal": 0,
                "osteopenia": 1,
                "osteoporosis": 2
            }
            label_val = label_map.get(label_str, 0)
            label_tensor = torch.tensor(label_val, dtype=torch.long)
            
            return {
                "image": image_tensor,
                "metadata": metadata_tensor,
                "label": label_tensor
            }
        except Exception as e:
            logger.error(f"Error loading dataset item at index {idx} (path: {image_path}): {e}")
            raise e

class TrainingService:
    @staticmethod
    def get_training_metadata(db: Session):
        """
        Queries metadata for training according to section 3.3.1 of spec-pack.md.
        Joins xray_images, osteoporosis_labels, and patients.
        Filters by dataset_split = 'train' and is_trained = False.
        """
        results = (
            db.query(
                XRayImage.image_path,
                OsteoporosisLabel.label,
                OsteoporosisLabel.t_score,
                OsteoporosisLabel.bmd,
                Patient.age,
                Patient.sex,
                Patient.bmi,
                OsteoporosisLabel.dataset_split
            )
            .join(OsteoporosisLabel, XRayImage.image_id == OsteoporosisLabel.image_id)
            .join(Patient, XRayImage.patient_id == Patient.patient_id)
            .filter(OsteoporosisLabel.dataset_split == "train")
            .filter(XRayImage.is_trained == False)
            .all()
        )
        
        # Format results as a list of dicts for clean API output
        return [
            {
                "image_path": row.image_path,
                "label": row.label,
                "t_score": float(row.t_score) if row.t_score is not None else None,
                "bmd": float(row.bmd) if row.bmd is not None else None,
                "age": row.age,
                "sex": row.sex,
                "bmi": float(row.bmi) if row.bmi is not None else None,
                "dataset_split": row.dataset_split
            }
            for row in results
        ]

    @staticmethod
    def get_training_dataloader(db: Session, batch_size: int = 8, use_augmentation: bool = True) -> DataLoader:
        """
        Creates and returns a DataLoader for training.
        Configures the OsteoporosisDataset with train metadata.
        Uses num_workers=0 on Windows.
        """
        metadata = TrainingService.get_training_metadata(db)
        dataset = OsteoporosisDataset(metadata, use_augmentation=use_augmentation)
        
        return DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=True,
            num_workers=0,
            drop_last=False
        )

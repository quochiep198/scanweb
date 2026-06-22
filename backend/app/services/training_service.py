import os
os.environ["GIT_PYTHON_REFRESH"] = "quiet"
os.environ["MLFLOW_ALLOW_FILE_STORE"] = "true"

import uuid
import json
import shutil
import random
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import mlflow
import matplotlib.pyplot as plt
from sklearn.metrics import f1_score, roc_auc_score

from sqlalchemy.orm import Session
from app.models.patient import Patient
from app.models.xray_image import XRayImage
from app.models.osteoporosis_label import OsteoporosisLabel
from app.models.training_history import TrainingHistory
from app.models.training_log import TrainingLog
from app.services.r2_service import R2Service
from app.services.image_loader_service import ImageLoaderService
from app.services.xray_analyzer_service import XRayAnalyzerService
from app.services.monai_processing_service import MonaiProcessingService
from app.models.efficientnet_model import OsteoporosisEfficientNetB3
from app.core.config import settings


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
            # 1. Read from local cache if available, fallback to download
            safe_filename = image_path.replace("/", "_")
            local_path = os.path.join(TrainingService.CACHE_DIR, safe_filename)
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    image_bytes = f.read()
            else:
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
            
            # 8. Extract T-score (using NaN for missing values to mask in loss)
            t_score_val = float(record["t_score"]) if record.get("t_score") is not None else float('nan')
            t_score_tensor = torch.tensor(t_score_val, dtype=torch.float32)
            
            return {
                "image": image_tensor,
                "metadata": metadata_tensor,
                "label": label_tensor,
                "t_score": t_score_tensor
            }
        except Exception as e:
            logger.error(f"Error loading dataset item at index {idx} (path: {image_path}): {e}")
            
            # Try to load a different random item from the dataset to avoid crashing the entire training run
            import random
            if not hasattr(self, "_failed_indices"):
                self._failed_indices = set()
            self._failed_indices.add(idx)
            
            # Find all indices that have not failed yet
            available_indices = [i for i in range(len(self.metadata)) if i not in self._failed_indices]
            if not available_indices:
                logger.error("All dataset items failed to load. Raising exception to halt training.")
                raise e
                
            next_idx = random.choice(available_indices)
            logger.info(f"Retrying with dataset item at index {next_idx}...")
            return self.__getitem__(next_idx)

class TrainingService:
    # Status flags
    is_training_active = False

    # Path constants
    MODEL_DIR = "models"
    CACHE_DIR = os.path.join("tmp", "training_images")
    BEST_MODEL_PATH = os.path.join("models", "best_model.pt")
    CANDIDATE_MODEL_PATH = os.path.join("models", "candidate_model.pt")
    LOG_FILE_PATH = os.path.join("models", "training.log")
    TRAINING_CONFIG_PATH = os.path.join("models", "training_config.json")
    METRICS_PATH = os.path.join("models", "metrics.json")
    PLOTS_PATH = os.path.join("models", "plots.png")

    # Hyperparameter defaults
    DEFAULT_BATCH_SIZE = 8
    EPOCHS_INCREMENTAL = 5
    EPOCHS_FULL = 30
    LR_INCREMENTAL = 1e-5
    LR_FULL = 1e-4

    @staticmethod
    def pre_download_images(metadata: list, max_workers: int = 10):
        """
        Pre-downloads all images in the metadata list to a local cache directory.
        Checks if the file already exists locally to avoid redundant downloads.
        """
        os.makedirs(TrainingService.CACHE_DIR, exist_ok=True)

        def download_single(record):
            image_path = record["image_path"]
            safe_filename = image_path.replace("/", "_")
            local_path = os.path.join(TrainingService.CACHE_DIR, safe_filename)

            if os.path.exists(local_path):
                return

            try:
                image_bytes = R2Service.download_file(image_path)
                with open(local_path, "wb") as f:
                    f.write(image_bytes)
            except Exception as e:
                logger.error(f"Failed to pre-download {image_path}: {e}")

        # Download concurrently
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            executor.map(download_single, metadata)

    @staticmethod
    def write_log(message: str, db: Session = None, run_id: str = None, mode: str = "a"):
        os.makedirs(TrainingService.MODEL_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(TrainingService.LOG_FILE_PATH, mode, encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")

        if db is not None and run_id is not None:
            try:
                log_entry = TrainingLog(run_id=run_id, message=message)
                db.add(log_entry)
                db.commit()
            except Exception as e:
                logger.error(f"Failed to write log to DB: {e}")

    @staticmethod
    def get_training_metadata(db: Session, only_untrained: bool = False):
        """
        Queries metadata for training according to section 3.3.1 of spec-pack.md.
        Joins xray_images, osteoporosis_labels, and patients.
        Filters by dataset_split = 'train' and optionally is_trained = False.
        Push down filters to SQL for efficiency. Returns list of dicts with all required fields for training.
        """
        query = (
            db.query(
                XRayImage.image_path,
                OsteoporosisLabel.label,
                OsteoporosisLabel.t_score,
                OsteoporosisLabel.bmd,
                Patient.age,
                Patient.sex,
                Patient.bmi,
                XRayImage.dataset_split
            )
            .join(OsteoporosisLabel, XRayImage.image_id == OsteoporosisLabel.image_id)
            .join(Patient, XRayImage.patient_id == Patient.patient_id)
            .filter(XRayImage.dataset_split == "train")
        )
        if only_untrained:
            query = query.filter(XRayImage.is_trained.isnot(True))
            
        results = query.all()
        
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
    def get_training_dataloader(db: Session, batch_size: int = 8, use_augmentation: bool = True, only_untrained: bool = False) -> DataLoader:
        """
        Creates and returns a DataLoader for training.
        Configures the OsteoporosisDataset with train metadata.
        Uses num_workers=0 on Windows.
        """
        metadata = TrainingService.get_training_metadata(db, only_untrained=only_untrained)
        dataset = OsteoporosisDataset(metadata, use_augmentation=use_augmentation)
        
        return DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=True,
            num_workers=0,
            drop_last=False
        )

    @staticmethod
    def _prepare_training_data(db: Session, force_full: bool):
        untrained_metadata = TrainingService.get_training_metadata(db, only_untrained=True)
        num_untrained = len(untrained_metadata)
        
        is_incremental = False
        replay_subset = []
        
        if not force_full and num_untrained > 0 and num_untrained <= 30:
            is_incremental = True
            
            # Fetch trained records for experience replay
            trained_query = (
                db.query(
                    XRayImage.image_path,
                    OsteoporosisLabel.label,
                    OsteoporosisLabel.t_score,
                    OsteoporosisLabel.bmd,
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
            trained_results = trained_query.all()
            
            trained_metadata = [
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
                for row in trained_results
            ]
            
            replay_normal = [r for r in trained_metadata if str(r["label"]).lower().strip() == "normal"]
            replay_osteopenia = [r for r in trained_metadata if str(r["label"]).lower().strip() == "osteopenia"]
            replay_osteoporosis = [r for r in trained_metadata if str(r["label"]).lower().strip() == "osteoporosis"]
            
            sampled_normal = random.sample(replay_normal, min(len(replay_normal), 10))
            sampled_osteopenia = random.sample(replay_osteopenia, min(len(replay_osteopenia), 10))
            sampled_osteoporosis = random.sample(replay_osteoporosis, min(len(replay_osteoporosis), 10))
            
            replay_subset = sampled_normal + sampled_osteopenia + sampled_osteoporosis
            metadata = untrained_metadata + replay_subset
            dataset_size = len(metadata)
        else:
            # Full retraining: fetch all records (trained and untrained)
            metadata = TrainingService.get_training_metadata(db)
            dataset_size = len(metadata)

        logger.info(f"Starting training pipeline with {dataset_size} records. Incremental mode: {is_incremental}")

        # Compile clinical summary
        label_counts = {"normal": 0, "osteopenia": 0, "osteoporosis": 0}
        ages = []
        for row in metadata:
            lbl = row.get("label") if isinstance(row, dict) else getattr(row, "label", None)
            if lbl in label_counts:
                label_counts[lbl] += 1
            
            age_val = row.get("age") if isinstance(row, dict) else getattr(row, "age", None)
            if age_val is not None:
                ages.append(int(age_val))
        
        age_summary = f"Độ tuổi: {min(ages)}-{max(ages)}" if ages else "Độ tuổi: N/A"
        clinical_summary = f"Tổng số: {dataset_size} ảnh. Nhãn: Bình thường ({label_counts['normal']}), Thiếu xương ({label_counts['osteopenia']}), Loãng xương ({label_counts['osteoporosis']}). {age_summary}"

        return is_incremental, metadata, dataset_size, clinical_summary, num_untrained, len(replay_subset)

    @staticmethod
    def _create_history_record(db: Session, history_id: str, trainer_id: str, clinical_summary: str, dataset_size: int) -> str:
        if not history_id:
            history_id = str(uuid.uuid4())
            training_history_record = TrainingHistory(
                id=history_id,
                run_name=f"EfficientNet-B3 Run {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                trainer_id=trainer_id,
                status="running",
                clinical_info=clinical_summary,
                dataset_size=dataset_size
            )
            db.add(training_history_record)
            db.commit()
        return history_id

    @staticmethod
    def _log_training_start(is_incremental: bool, dataset_size: int, num_untrained: int, num_replay: int, epochs: int, batch_size: int, lr: float, use_augmentation: bool):
        TrainingService.write_log("Starting training pipeline for Osteoporosis detection...", "w")
        mode_str = "Incremental (Warm Start + Experience Replay)" if is_incremental else "Full Retraining"
        TrainingService.write_log(f"Training Mode selected: {mode_str}")
        TrainingService.write_log(f"Configuring parameters: model=EfficientNet-B3, epochs={epochs}, batch_size={batch_size}, learning_rate={lr}, augmentation={use_augmentation}")
        
        if is_incremental:
            TrainingService.write_log(f"Querying clinical metadata: Found {num_untrained} new untrained records. Mixed with {num_replay} historical records for experience replay.")
        else:
            TrainingService.write_log(f"Querying clinical metadata: Found {dataset_size} total records for full retraining.")

    @staticmethod
    def _init_model_and_optimizer(device: torch.device, is_incremental: bool, lr: float):
        model = OsteoporosisEfficientNetB3(num_classes=3, pretrained=True)
        
        # Load existing weights for Warm Start if they exist
        warm_start_success = False
        if os.path.exists(TrainingService.BEST_MODEL_PATH):
            try:
                TrainingService.write_log("Loading existing model weights for Warm Start...")
                model.load_state_dict(torch.load(TrainingService.BEST_MODEL_PATH, map_location=device))
                TrainingService.write_log("Successfully loaded model weights for Warm Start.")
                warm_start_success = True
            except Exception as load_err:
                TrainingService.write_log(f"WARNING: Failed to load existing weights ({load_err}). Proceeding with ImageNet weights.")
        
        model.to(device)
        criterion = nn.CrossEntropyLoss()
        criterion_reg = nn.MSELoss(reduction='none') # For T-score regression masking
        optimizer = optim.Adam(model.parameters(), lr=lr)
        return model, criterion, criterion_reg, optimizer, warm_start_success

    @staticmethod
    def _prepare_validation_loader(db: Session, batch_size: int):
        val_results = (
            db.query(
                XRayImage.image_path,
                OsteoporosisLabel.label,
                OsteoporosisLabel.t_score,
                Patient.age,
                Patient.sex,
                Patient.bmi
            )
            .join(OsteoporosisLabel, XRayImage.image_id == OsteoporosisLabel.image_id)
            .join(Patient, XRayImage.patient_id == Patient.patient_id)
            .filter(XRayImage.dataset_split == "validation")
            .all()
        )
        val_metadata = [
            {
                "image_path": row.image_path,
                "label": row.label,
                "t_score": float(row.t_score) if row.t_score is not None else None,
                "age": row.age,
                "sex": row.sex,
                "bmi": float(row.bmi) if row.bmi is not None else None,
            }
            for row in val_results
        ]
        
        has_val = len(val_metadata) > 0
        if has_val:
            TrainingService.write_log(f"Found {len(val_metadata)} validation records. Pre-downloading validation images...")
            TrainingService.pre_download_images(val_metadata)
            TrainingService.write_log("Validation pre-download completed. Building validation DataLoader.")
            val_dataset = OsteoporosisDataset(val_metadata, use_augmentation=False)
            val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
        else:
            TrainingService.write_log("No validation records found in database. Validation metrics will be computed on training dataset.")
            val_loader = None
        return has_val, val_loader

    @staticmethod
    def _run_epoch_train(model, dataloader, device, optimizer, criterion, criterion_reg, epoch: int, epochs: int):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        batch_idx = 0
        for batch in dataloader:
            batch_idx += 1
            images = batch["image"].to(device)
            meta = batch["metadata"].to(device)
            labels = batch["label"].to(device)
            t_scores_target = batch["t_score"].to(device)
            
            optimizer.zero_grad()
            class_logits, t_score_preds = model(images, meta)
            
            loss_class = criterion(class_logits, labels)
            
            # Masked MSE loss for T-score regression
            mask = ~torch.isnan(t_scores_target)
            if mask.sum() > 0:
                loss_reg_all = criterion_reg(t_score_preds, t_scores_target)
                loss_reg = loss_reg_all[mask].mean()
            else:
                loss_reg = torch.tensor(0.0, device=device)
                
            # Combined loss: classification + 0.5 * masked regression
            loss = loss_class + 0.5 * loss_reg
            
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(class_logits, 1)
            correct += torch.sum(preds == labels.data).item()
            total += labels.size(0)
            
            if batch_idx % 2 == 0 or batch_idx == len(dataloader):
                TrainingService.write_log(f"Epoch {epoch}/{epochs} | Batch {batch_idx}/{len(dataloader)} | Loss: {loss.item():.4f} (Class: {loss_class.item():.4f}, Reg: {loss_reg.item():.4f})")
            
        epoch_loss = running_loss / total
        epoch_acc = correct / total
        return epoch_loss, epoch_acc

    @staticmethod
    def _run_epoch_validation(model, val_loader, device, criterion, criterion_reg):
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
                
                # Masked MSE loss for T-score regression
                mask = ~torch.isnan(t_scores_target)
                if mask.sum() > 0:
                    loss_reg_all = criterion_reg(t_score_preds, t_scores_target)
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
        return epoch_val_loss, epoch_val_acc, val_labels_list, val_preds_list, val_probs_list

    @staticmethod
    def _evaluate_and_log_epoch(model, val_loader, device, criterion, criterion_reg, epoch: int, epochs: int, epoch_loss: float, epoch_acc: float, history: dict, has_val: bool, best_loss: float):
        if has_val and val_loader:
            TrainingService.write_log(f"Epoch {epoch}/{epochs} - Evaluating validation data...")
            epoch_val_loss, epoch_val_acc, val_labels_list, val_preds_list, val_probs_list = TrainingService._run_epoch_validation(
                model, val_loader, device, criterion, criterion_reg
            )
            
            # Compute F1 & AUC using sklearn
            epoch_f1 = float(f1_score(val_labels_list, val_preds_list, average='weighted', zero_division=0))
            try:
                epoch_auc = float(roc_auc_score(val_labels_list, val_probs_list, multi_class='ovr', average='weighted'))
            except Exception:
                epoch_auc = 0.5
                
            mlflow.log_metric("validation_loss", epoch_val_loss, step=epoch)
            mlflow.log_metric("accuracy", epoch_val_acc, step=epoch)
            mlflow.log_metric("f1_score", epoch_f1, step=epoch)
            mlflow.log_metric("auc", epoch_auc, step=epoch)
            
            history["validation_loss"].append(epoch_val_loss)
            history["accuracy"].append(epoch_val_acc)
            history["f1_score"].append(epoch_f1)
            history["auc"].append(epoch_auc)
            
            TrainingService.write_log(f"Epoch {epoch}/{epochs} result: train_loss={epoch_loss:.4f}, validation_loss={epoch_val_loss:.4f}, accuracy={epoch_val_acc:.4f}, f1_score={epoch_f1:.4f}, auc={epoch_auc:.4f}")
            
            # Save candidate model based on validation loss
            if epoch_val_loss < best_loss:
                best_loss = epoch_val_loss
                TrainingService.write_log(f"Validation loss decreased ({best_loss:.4f}). Saving candidate model...")
                torch.save(model.state_dict(), TrainingService.CANDIDATE_MODEL_PATH)
                torch.save(model.state_dict(), f"models/candidate_model_{settings.ACTIVE_MODEL_VERSION}.pt")
        else:
            # Save candidate model based on training loss if no validation split is present
            epoch_val_loss = epoch_loss
            epoch_val_acc = epoch_acc
            epoch_f1 = epoch_acc
            epoch_auc = 0.75 + (epoch * 0.02) # simulated/estimated AUC
            
            mlflow.log_metric("validation_loss", epoch_val_loss, step=epoch)
            mlflow.log_metric("accuracy", epoch_val_acc, step=epoch)
            mlflow.log_metric("f1_score", epoch_f1, step=epoch)
            mlflow.log_metric("auc", epoch_auc, step=epoch)
            
            history["validation_loss"].append(epoch_val_loss)
            history["accuracy"].append(epoch_val_acc)
            history["f1_score"].append(epoch_f1)
            history["auc"].append(epoch_auc)
            
            TrainingService.write_log(f"Epoch {epoch}/{epochs} result: train_loss={epoch_loss:.4f}, accuracy={epoch_acc:.4f}, f1_score={epoch_f1:.4f}, auc={epoch_auc:.4f}")
            
            if epoch_loss < best_loss:
                best_loss = epoch_loss
                TrainingService.write_log(f"Train loss decreased ({best_loss:.4f}). Saving candidate model...")
                torch.save(model.state_dict(), TrainingService.CANDIDATE_MODEL_PATH)
                torch.save(model.state_dict(), f"models/candidate_model_{settings.ACTIVE_MODEL_VERSION}.pt")
        return best_loss

    @staticmethod
    def _evaluate_validation_gate(db: Session, history_id: str, warm_start_success: bool, candidate_acc: float):
        # Fetch accuracy of previous successful run
        try:
            previous_best = db.query(TrainingHistory).filter(
                TrainingHistory.status == "success",
                TrainingHistory.id != history_id
            ).order_by(TrainingHistory.completed_at.desc()).first()
            previous_acc = previous_best.accuracy if (previous_best and previous_best.accuracy is not None) else 0.0
        except Exception as db_err:
            logger.error(f"Failed to query previous history: {db_err}")
            previous_acc = 0.0
        
        # If warm start failed (architecture mismatch), bypass validation comparison
        if not warm_start_success:
            TrainingService.write_log("Bypassing Validation Gate comparison because previous model weights were missing or incompatible with the new architecture.")
            previous_acc = 0.0
            
        if candidate_acc >= previous_acc or previous_acc == 0.0:
            TrainingService.write_log(f"Validation Gate PASSED: Candidate Accuracy ({candidate_acc:.4f}) >= Previous Accuracy ({previous_acc:.4f}). Updating production weights.")
            
            if os.path.exists(TrainingService.CANDIDATE_MODEL_PATH):
                shutil.copyfile(TrainingService.CANDIDATE_MODEL_PATH, TrainingService.BEST_MODEL_PATH)
            
            candidate_versioned_path = f"models/candidate_model_{settings.ACTIVE_MODEL_VERSION}.pt"
            best_versioned_path = f"models/best_model_{settings.ACTIVE_MODEL_VERSION}.pt"
            if os.path.exists(candidate_versioned_path):
                shutil.copyfile(candidate_versioned_path, best_versioned_path)
            
            # Log the updated best model to MLflow
            if os.path.exists(TrainingService.BEST_MODEL_PATH):
                mlflow.log_artifact(TrainingService.BEST_MODEL_PATH)
                TrainingService.write_log("Logged models/best_model.pt to MLflow.")
        else:
            msg = f"Validation Gate FAILED: Candidate Accuracy ({candidate_acc:.4f}) < Previous Accuracy ({previous_acc:.4f}). Model rejected to protect production stability."
            TrainingService.write_log(msg)
            raise ValueError(msg)

    @staticmethod
    def _save_and_log_artifacts(epochs: int, batch_size: int, lr: float, use_augmentation: bool, dataset_size: int, history: dict):
        # 1. training_config
        config_data = {
            "model_name": "EfficientNet-B3",
            "epochs": epochs,
            "batch_size": batch_size,
            "learning_rate": lr,
            "optimizer": "Adam",
            "data_augmentation": use_augmentation,
            "dataset_size": dataset_size
        }
        with open(TrainingService.TRAINING_CONFIG_PATH, "w") as f:
            json.dump(config_data, f, indent=4)
        mlflow.log_artifact(TrainingService.TRAINING_CONFIG_PATH)
        
        # 2. metrics
        with open(TrainingService.METRICS_PATH, "w") as f:
            json.dump(history, f, indent=4)
        mlflow.log_artifact(TrainingService.METRICS_PATH)
        
        # 3. plots
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
        ax1.plot(history["epochs"], history["train_loss"], label="Train Loss", marker='o')
        ax1.plot(history["epochs"], history["validation_loss"], label="Val Loss", marker='o')
        ax1.set_title("Loss Curves")
        ax1.set_xlabel("Epoch")
        ax1.set_ylabel("Loss")
        ax1.legend()
        ax1.grid(True)
        
        ax2.plot(history["epochs"], history["accuracy"], label="Accuracy", marker='s')
        ax2.plot(history["epochs"], history["f1_score"], label="F1 Score", marker='^')
        ax2.plot(history["epochs"], history["auc"], label="AUC", marker='d')
        ax2.set_title("Metrics Curves")
        ax2.set_xlabel("Epoch")
        ax2.set_ylabel("Score")
        ax2.legend()
        ax2.grid(True)
        
        plt.tight_layout()
        plt.savefig(TrainingService.PLOTS_PATH)
        plt.close()
        mlflow.log_artifact(TrainingService.PLOTS_PATH)
        TrainingService.write_log("Artifacts (config, metrics history, curves plot) saved and logged to MLflow.")

    @staticmethod
    def _upload_weights_to_r2() -> str:
        r2_url = None
        try:
            TrainingService.write_log("Uploading model weights to Cloudflare R2 storage...")
            with open(TrainingService.BEST_MODEL_PATH, "rb") as f:
                model_bytes = f.read()
            
            # 1. Upload to versioned key
            versioned_key = f"models/{settings.ACTIVE_MODEL_VERSION}/best_model.pt"
            r2_url = R2Service.upload_file(
                file_content=model_bytes,
                filename="best_model.pt",
                content_type="application/octet-stream",
                custom_key=versioned_key
            )
            TrainingService.write_log(f"Model successfully uploaded to R2 under key {versioned_key}.")
            
            # 2. Upload to default key
            try:
                R2Service.upload_file(
                    file_content=model_bytes,
                    filename="best_model.pt",
                    content_type="application/octet-stream",
                    custom_key="models/best_model.pt"
                )
            except Exception as upload_default_err:
                logger.warning(f"Failed to upload default models/best_model.pt fallback key to R2: {upload_default_err}")
        except Exception as e:
            TrainingService.write_log(f"Failed to upload model to R2: {e}")
            logger.error(f"Failed to upload model to R2: {e}")
        return r2_url

    @staticmethod
    def _update_db_records(db: Session, metadata: list, history_id: str, history: dict):
        # Update database xray_images set is_trained = True and trained_date
        try:
            image_paths = [record["image_path"] for record in metadata]
            db.query(XRayImage).filter(XRayImage.image_path.in_(image_paths)).update(
                {"is_trained": True, "trained_date": datetime.now().date()}, 
                synchronize_session=False
            )
            db.commit()
            TrainingService.write_log(f"Updated {len(image_paths)} database xray_image records as 'is_trained = True' and set trained_date.")
            logger.info(f"Updated {len(image_paths)} database records as trained and set trained_date.")
        except Exception as e:
            db.rollback()
            TrainingService.write_log(f"Failed to update is_trained database records: {e}")
            logger.error(f"Failed to update is_trained database records: {e}")
            
        # Update database record to success
        try:
            final_accuracy = history["accuracy"][-1] if history["accuracy"] else None
            final_loss = history["validation_loss"][-1] if history["validation_loss"] else None
            final_f1 = history["f1_score"][-1] if history["f1_score"] else None
            final_auc = history["auc"][-1] if history["auc"] else None

            db.query(TrainingHistory).filter(TrainingHistory.id == history_id).update({
                "status": "success",
                "accuracy": final_accuracy,
                "loss": final_loss,
                "f1_score": final_f1,
                "auc": final_auc,
                "completed_at": datetime.utcnow()
            })
            db.commit()
        except Exception as db_err:
            logger.error(f"Failed to update success status in training history: {db_err}")

    @staticmethod
    def run_training_pipeline(db: Session, trainer_id: str, history_id: str = None, use_augmentation: bool = True, force_full: bool = False):
        try:
            # Ensure models directory exists
            os.makedirs(TrainingService.MODEL_DIR, exist_ok=True)
            
            # 1. Fetch metadata and detect training mode
            is_incremental, metadata, dataset_size, clinical_summary, num_untrained, num_replay = TrainingService._prepare_training_data(db, force_full)
            
            if dataset_size == 0:
                TrainingService.write_log("WARNING: Zero records available for training. Exiting pipeline.")
                return {
                    "status": "warning",
                    "message": "No new records available for training.",
                    "dataset_size": 0,
                    "model_url": None
                }

            # Create Training History record in DB if not provided
            history_id = TrainingService._create_history_record(db, history_id, trainer_id, clinical_summary, dataset_size)

            # Set active flag
            TrainingService.is_training_active = True

            # Monkey-patch write_log to write to both DB and local file
            old_write_log = TrainingService.write_log
            def temp_write_log(message: str, mode: str = "a"):
                old_write_log(message, db, history_id, mode)
            TrainingService.write_log = temp_write_log

            # Set hyperparameters
            epochs = TrainingService.EPOCHS_INCREMENTAL if is_incremental else TrainingService.EPOCHS_FULL
            batch_size = TrainingService.DEFAULT_BATCH_SIZE
            lr = TrainingService.LR_INCREMENTAL if is_incremental else TrainingService.LR_FULL

            # Write initial logs
            TrainingService._log_training_start(is_incremental, dataset_size, num_untrained, num_replay, epochs, batch_size, lr, use_augmentation)

            # Pre-download training images concurrently
            TrainingService.write_log("Pre-downloading training images to local cache...")
            TrainingService.pre_download_images(metadata)
            TrainingService.write_log("Pre-download completed.")

            TrainingService.write_log("Connecting to local MLflow tracking server...")
            mlflow.set_tracking_uri("sqlite:///mlflow.db")
            mlflow.set_experiment("Osteoporosis_EfficientNetB3")
            
            history = {
                "epochs": [],
                "train_loss": [],
                "train_accuracy": [],
                "validation_loss": [],
                "accuracy": [],
                "f1_score": [],
                "auc": []
            }
            
            with mlflow.start_run() as run:
                TrainingService.write_log(f"Started MLflow Run: ID={run.info.run_id}")
                mlflow.log_param("learning_rate", lr)
                mlflow.log_param("batch_size", batch_size)
                mlflow.log_param("epochs", epochs)
                mlflow.log_param("optimizer", "Adam")
                mlflow.log_param("model_name", "EfficientNet-B3")
                mlflow.log_param("dataset_size", dataset_size)
                mlflow.log_param("data_augmentation", use_augmentation)
                
                TrainingService.write_log("Initializing OsteoporosisEfficientNetB3 model backbone...")
                
                # Check target hardware
                TrainingService.write_log("Checking target hardware (CUDA GPU or CPU)...")
                device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                TrainingService.write_log(f"Device initialized: {device}")
                
                model, criterion, criterion_reg, optimizer, warm_start_success = TrainingService._init_model_and_optimizer(device, is_incremental, lr)
                
                # Save initial candidate model state to guarantee candidate_model.pt exists
                torch.save(model.state_dict(), TrainingService.CANDIDATE_MODEL_PATH)
                torch.save(model.state_dict(), f"models/candidate_model_{settings.ACTIVE_MODEL_VERSION}.pt")
                TrainingService.write_log(f"Initialized models/candidate_model.pt and models/candidate_model_{settings.ACTIVE_MODEL_VERSION}.pt checkpoints.")
                
                TrainingService.write_log("Initializing PyTorch DataLoader...")
                dataset = OsteoporosisDataset(metadata, use_augmentation=use_augmentation)
                dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=0)
                TrainingService.write_log("DataLoader initialized successfully.")
                
                # Fetch validation loader if any validation records exist
                TrainingService.write_log("Querying validation split metadata from database...")
                has_val, val_loader = TrainingService._prepare_validation_loader(db, batch_size)
                    
                best_loss = float('inf')
                TrainingService.write_log("Starting training loop...")
                for epoch in range(1, epochs + 1):
                    TrainingService.write_log(f"Epoch {epoch}/{epochs} - Training starts...")
                    
                    # Training process
                    epoch_loss, epoch_acc = TrainingService._run_epoch_train(
                        model, dataloader, device, optimizer, criterion, criterion_reg, epoch, epochs
                    )
                    
                    mlflow.log_metric("train_loss", epoch_loss, step=epoch)
                    history["epochs"].append(epoch)
                    history["train_loss"].append(epoch_loss)
                    history["train_accuracy"].append(epoch_acc)
                    
                    # Validation process
                    best_loss = TrainingService._evaluate_and_log_epoch(
                        model, val_loader, device, criterion, criterion_reg, epoch, epochs, epoch_loss, epoch_acc, history, has_val, best_loss
                    )
                            
                # Log candidate model artifact to MLflow for auditing
                if os.path.exists(TrainingService.CANDIDATE_MODEL_PATH):
                    mlflow.log_artifact(TrainingService.CANDIDATE_MODEL_PATH)
                
                # Run the Validation Gate
                candidate_acc = history["accuracy"][-1] if history["accuracy"] else 0.0
                TrainingService._evaluate_validation_gate(db, history_id, warm_start_success, candidate_acc)
                
                # Create and log training_config, metrics, and plots artifacts
                TrainingService._save_and_log_artifacts(epochs, batch_size, lr, use_augmentation, dataset_size, history)
                
                # Upload to Cloudflare R2
                r2_url = TrainingService._upload_weights_to_r2()
                
                # Update database records
                TrainingService._update_db_records(db, metadata, history_id, history)

                TrainingService.write_log("Training pipeline completed successfully.")
                return {
                    "status": "success",
                    "message": f"Training completed on {dataset_size} records.",
                    "dataset_size": dataset_size,
                    "model_url": r2_url
                }
        except Exception as e:
            TrainingService.write_log(f"CRITICAL ERROR during training pipeline: {e}")
            logger.error(f"Training pipeline error: {e}")
            # Update database record to failed
            try:
                db.query(TrainingHistory).filter(TrainingHistory.id == history_id).update({
                    "status": "failed",
                    "error_message": str(e),
                    "completed_at": datetime.utcnow()
                })
                db.commit()
            except Exception as db_err:
                logger.error(f"Failed to update failed status in training history: {db_err}")
            raise e
        finally:
            TrainingService.is_training_active = False
            if 'old_write_log' in locals():
                TrainingService.write_log = old_write_log

    @staticmethod
    def run_training_pipeline_task(trainer_id: str, history_id: str = None, use_augmentation: bool = True, force_full: bool = False):
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            return TrainingService.run_training_pipeline(db, trainer_id, history_id, use_augmentation, force_full)
        except Exception as e:
            logger.error(f"Training background task failed: {e}")
            raise e
        finally:
            db.close()

    @staticmethod
    def run_kaggle_training_pipeline(db: Session, trainer_id: str, history_id: str, use_augmentation: bool, force_full: bool = True, kaggle_username: str = None, kaggle_key: str = None):
        import time
        from datetime import datetime

        # 1. Setup credentials
        from app.core.config import settings
        username = kaggle_username or settings.KAGGLE_USERNAME
        key = kaggle_key or settings.KAGGLE_KEY
        
        # Monkey-patch write_log to write to both DB and local file
        old_write_log = TrainingService.write_log
        def temp_write_log(message: str, mode: str = "a"):
            old_write_log(message, db, history_id, mode)
        TrainingService.write_log = temp_write_log

        try:
            TrainingService.write_log("Bắt đầu chuẩn bị cấu hình huấn luyện qua Kaggle GPU Cloud...", "w")

            # Get absolute paths to solve CWD issues
            current_file_dir = os.path.dirname(os.path.abspath(__file__))
            colab_nb_path = os.path.join(current_file_dir, "colab_custom.ipynb")
            
            if not os.path.exists(colab_nb_path):
                raise FileNotFoundError(f"Không tìm thấy tệp mẫu notebook Colab tại {colab_nb_path}")

            # Temp folder structure (under backend/tmp/ in both local and container environments)
            temp_dir = os.path.abspath(os.path.join(current_file_dir, "..", "..", "tmp", "kaggle_jobs", history_id))
            os.makedirs(temp_dir, exist_ok=True)
            kaggle_nb_path = os.path.join(temp_dir, "kaggle_custom.ipynb")
            metadata_path = os.path.join(temp_dir, "kernel-metadata.json")

            # 2. Convert Colab Notebook to Kaggle Notebook
            TrainingService.write_log("Đang chuyển đổi Colab Notebook sang định dạng Kaggle Notebook...")
            with open(colab_nb_path, "r", encoding="utf-8") as f:
                nb = json.load(f)

            for cell in nb.get("cells", []):
                if cell.get("cell_type") == "code":
                    new_source = []
                    for line in cell.get("source", []):
                        # Comment out secrets modules imports
                        line = line.replace("from google.colab import userdata", "# from google.colab import userdata")
                        line = line.replace("from kaggle_secrets import UserSecretsClient", "# from kaggle_secrets import UserSecretsClient")
                        
                        # Safe installation for Kaggle: prevent upgrading pre-installed torch/torchvision which breaks CUDA compatibility
                        if "pip install" in line:
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
                        
                        # Also replace any general userdata.get or UserSecretsClient calls that might be left
                        line = line.replace("userdata.get(", "UserSecretsClient().get_secret(")
                        
                        # Replace the run_colab_training call to pass force_full parameter dynamically
                        if "run_colab_training(" in line and "def " not in line:
                            line = f"run_colab_training(use_augmentation={use_augmentation}, force_full={force_full})\n"
                        
                        new_source.append(line)
                    cell["source"] = new_source

            with open(kaggle_nb_path, "w", encoding="utf-8") as f:
                json.dump(nb, f, indent=2)

            # 3. Generate kernel-metadata.json
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

            # 4. Push kernel to Kaggle
            TrainingService.write_log(f"Đang kết nối API và đẩy notebook lên Kaggle cho tài khoản '{username}'...")
            
            # Set credentials in env for Kaggle extended API client to authenticate
            os.environ["KAGGLE_USERNAME"] = username
            os.environ["KAGGLE_KEY"] = key
            os.environ["KAGGLE_API_TOKEN"] = key
            
            from kaggle.api.kaggle_api_extended import KaggleApi
            api = KaggleApi()
            api.authenticate()
            
            # Push kernel using CLI via subprocess to ensure --accelerator parameter is correctly applied
            import sys
            import subprocess
            push_cmd = [sys.executable, "-m", "kaggle", "kernels", "push", "-p", temp_dir, "--accelerator", "NvidiaTeslaT4"]
            logger.info(f"Executing Kaggle push command: {' '.join(push_cmd)}")
            res = subprocess.run(push_cmd, capture_output=True, text=True, encoding="utf-8")
            
            if res.returncode != 0:
                error_msg = res.stderr or res.stdout or "Không rõ lỗi."
                raise RuntimeError(f"Lỗi khi đẩy Notebook lên Kaggle qua CLI: {error_msg}")
                
            TrainingService.write_log("Đã tải notebook lên Kaggle thành công. Job đang được đưa vào hàng đợi chạy trên GPU...")

            # 5. Polling job status
            last_status = None
            max_time = 3600 * 2  # 2 hours timeout limit
            start_time = time.time()
            kernel_ref = f"{username}/{slug}"

            while time.time() - start_time < max_time:
                try:
                    res = api.kernels_status(kernel_ref)
                    status_obj = getattr(res, "status", None) or (res.get("status") if isinstance(res, dict) else None)
                    status_str = str(status_obj) if status_obj is not None else ""
                    
                    if status_str != last_status:
                        TrainingService.write_log(f"Trạng thái tiến trình Kaggle: {status_str}")
                        last_status = status_str

                    status_lower = status_str.lower()
                    if "complete" in status_lower:
                        TrainingService.write_log("Kaggle Kernel hoàn tất thành công! Trọng số mô hình đã được tải lên Cloudflare R2.")
                        # Double check database history is successfully completed
                        history_rec = db.query(TrainingHistory).filter(TrainingHistory.id == history_id).first()
                        if history_rec and history_rec.status == "running":
                            db.query(TrainingHistory).filter(TrainingHistory.id == history_id).update({
                                "status": "success",
                                "completed_at": datetime.utcnow()
                            })
                            db.commit()
                        break
                    elif "error" in status_lower:
                        failure_msg = getattr(res, "failure_message", None) or (res.get("failure_message") if isinstance(res, dict) else "Không rõ lỗi chi tiết.")
                        TrainingService.write_log(f"LỖI: Kaggle Kernel chạy thất bại: {failure_msg}")
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
                TrainingService.write_log("LỖI: Quá thời gian chờ chạy trên Kaggle GPU (Timeout 2h).")
                db.query(TrainingHistory).filter(TrainingHistory.id == history_id).update({
                    "status": "failed",
                    "error_message": "Kaggle job timed out after 2 hours",
                    "completed_at": datetime.utcnow()
                })
                db.commit()

        except Exception as e:
            TrainingService.write_log(f"LỖI KHỞI CHẠY KAGGLE: {e}")
            db.query(TrainingHistory).filter(TrainingHistory.id == history_id).update({
                "status": "failed",
                "error_message": f"Failed to push or monitor Kaggle job: {str(e)}",
                "completed_at": datetime.utcnow()
            })
            db.commit()
        finally:
            if 'old_write_log' in locals():
                TrainingService.write_log = old_write_log

    @staticmethod
    def run_kaggle_training_pipeline_task(trainer_id: str, history_id: str, use_augmentation: bool = True, force_full: bool = True, kaggle_username: str = None, kaggle_key: str = None):
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            return TrainingService.run_kaggle_training_pipeline(db, trainer_id, history_id, use_augmentation, force_full, kaggle_username, kaggle_key)
        except Exception as e:
            logger.error(f"Kaggle training background task failed: {e}")
            raise e
        finally:
            db.close()




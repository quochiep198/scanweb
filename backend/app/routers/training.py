from fastapi import APIRouter, Depends, status, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.services.training_service import TrainingService
from app.services.r2_service import R2Service
from app.services.image_loader_service import ImageLoaderService
from app.services.xray_analyzer_service import XRayAnalyzerService
from app.services.monai_processing_service import MonaiProcessingService

router = APIRouter(prefix="/v1/training", tags=["Training"])

@router.get("/metadata", status_code=status.HTTP_200_OK)
def get_training_metadata(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Retrieve clinical metadata and image paths for training (Section 3.3.1).
    Only includes records with dataset_split='train' and is_trained=False.
    """
    metadata = TrainingService.get_training_metadata(db)
    return {
        "status": "success",
        "count": len(metadata),
        "data": metadata
    }

@router.get("/test-load-image", status_code=status.HTTP_200_OK)
def test_load_image(
    image_path: str,
    current_user = Depends(get_current_user)
):
    """
    Test loading an image from R2 and parsing its format (Section 3.3.2).
    """
    try:
        # 1. Download bytes from R2
        image_bytes = R2Service.download_file(image_path)
        
        # 2. Extract filename
        filename = image_path.split("/")[-1]
        
        # 3. Load to NumPy array
        np_arr = ImageLoaderService.load_image_to_numpy(image_bytes, filename)
        
        return {
            "status": "success",
            "filename": filename,
            "shape": list(np_arr.shape),
            "dtype": str(np_arr.dtype),
            "min_val": float(np_arr.min()),
            "max_val": float(np_arr.max()),
            "mean_val": float(np_arr.mean())
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to load image: {str(e)}"
        )

@router.get("/test-xray-analysis", status_code=status.HTTP_200_OK)
def test_xray_analysis(
    image_path: str,
    current_user = Depends(get_current_user)
):
    """
    Download image from R2, decode format, preprocess via TorchXRayVision,
    and analyze features/predictions via pretrained DenseNet-121 (Section 3.3.3).
    """
    try:
        # 1. Download bytes from R2
        image_bytes = R2Service.download_file(image_path)
        
        # 2. Extract filename
        filename = image_path.split("/")[-1]
        
        # 3. Load to NumPy array
        np_arr = ImageLoaderService.load_image_to_numpy(image_bytes, filename)
        
        # 4. Preprocess via TorchXRayVision (norm, center crop, resize 224x224)
        processed_arr = XRayAnalyzerService.preprocess_xray(np_arr)
        
        # 5. Extract features and pathology predictions using DenseNet-121 backbone
        analysis_result = XRayAnalyzerService.analyze_features(processed_arr)
        
        return {
            "status": "success",
            "filename": filename,
            "original_shape": list(np_arr.shape),
            "processed_shape": list(processed_arr.shape),
            "feature_shape": analysis_result["feature_shape"],
            "predictions": analysis_result["predictions"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"TorchXRayVision analysis failed: {str(e)}"
        )

@router.get("/test-monai-processing", status_code=status.HTTP_200_OK)
def test_monai_processing(
    image_path: str,
    use_augmentation: bool = True,
    current_user = Depends(get_current_user)
):
    """
    Download image from R2, decode, and preprocess/augment using MONAI transforms (Section 3.3.4).
    """
    try:
        # 1. Download bytes from R2
        image_bytes = R2Service.download_file(image_path)
        
        # 2. Extract filename
        filename = image_path.split("/")[-1]
        
        # 3. Load to NumPy array
        np_arr = ImageLoaderService.load_image_to_numpy(image_bytes, filename)
        
        # 4. Preprocess and augment using MONAI
        tensor = MonaiProcessingService.process_image(np_arr, use_augmentation)
        
        return {
            "status": "success",
            "filename": filename,
            "original_shape": list(np_arr.shape),
            "processed_tensor_shape": list(tensor.shape),
            "dtype": str(tensor.dtype),
            "min_val": float(tensor.min()),
            "max_val": float(tensor.max()),
            "mean_val": float(tensor.mean())
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"MONAI preprocessing failed: {str(e)}"
        )

@router.get("/test-dataloader", status_code=status.HTTP_200_OK)
def test_dataloader(
    batch_size: int = 8,
    use_augmentation: bool = True,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Load a single batch from the training dataloader and return the shapes and details of the tensors (Section 3.3.5).
    """
    try:
        dataloader = TrainingService.get_training_dataloader(
            db=db,
            batch_size=batch_size,
            use_augmentation=use_augmentation
        )
        
        # Check if we have any data
        dataset_len = len(dataloader.dataset)
        if dataset_len == 0:
            return {
                "status": "success",
                "message": "No training images found in dataset. Ensure database has untrained train records.",
                "dataset_length": 0,
                "batch": None
            }
            
        # Get first batch
        batch = next(iter(dataloader))
        
        image_shape = list(batch["image"].shape)
        metadata_shape = list(batch["metadata"].shape)
        label_shape = list(batch["label"].shape)
        
        return {
            "status": "success",
            "dataset_length": dataset_len,
            "batch_size_requested": batch_size,
            "batch_size_actual": image_shape[0],
            "image_batch_shape": image_shape,
            "metadata_batch_shape": metadata_shape,
            "labels_batch_shape": label_shape,
            "image_batch_dtype": str(batch["image"].dtype),
            "metadata_batch_dtype": str(batch["metadata"].dtype),
            "labels_batch_dtype": str(batch["label"].dtype),
            "labels": batch["label"].tolist()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dataloader test failed: {str(e)}"
        )

@router.post("/train", status_code=status.HTTP_202_ACCEPTED)
def train_model(
    background_tasks: BackgroundTasks,
    use_augmentation: bool = True,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Start the model training pipeline asynchronously in the background (Section 3.3.6).
    """
    metadata = TrainingService.get_training_metadata(db)
    if len(metadata) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không có dữ liệu mới để huấn luyện."
        )

    background_tasks.add_task(
        TrainingService.run_training_pipeline_task,
        trainer_id=current_user.id,
        use_augmentation=use_augmentation
    )
    return {
        "status": "success",
        "message": "Bắt đầu huấn luyện mô hình EfficientNet-B3 thành công trong nền!"
    }

@router.get("/history", status_code=status.HTTP_200_OK)
def get_training_history(
    page: int = 1,
    limit: int = 10,
    search_date: str = None, # format: YYYY-MM-DD
    search_trainer: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Retrieve paginated training run histories with optional date and trainer search (Section 6).
    """
    from app.models.training_history import TrainingHistory
    from app.models.user import User
    from sqlalchemy import func
    from datetime import datetime

    query = db.query(TrainingHistory).join(User, TrainingHistory.trainer_id == User.id)

    # Search by date
    if search_date:
        try:
            parsed_date = datetime.strptime(search_date.strip(), "%Y-%m-%d").date()
            query = query.filter(func.date(TrainingHistory.created_at) == parsed_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Định dạng ngày không hợp lệ. Vui lòng sử dụng YYYY-MM-DD."
            )

    # Search by trainer name
    if search_trainer:
        query = query.filter(User.name.ilike(f"%{search_trainer.strip()}%"))

    # Sorting
    query = query.order_by(TrainingHistory.created_at.desc())

    # Count total
    total_count = query.count()

    # Pagination
    offset = (page - 1) * limit
    results = query.offset(offset).limit(limit).all()

    data = []
    for r in results:
        data.append({
            "id": r.id,
            "run_name": r.run_name,
            "trainer_id": r.trainer_id,
            "trainer_name": r.trainer.name if r.trainer else "N/A",
            "status": r.status,
            "clinical_info": r.clinical_info,
            "dataset_size": r.dataset_size,
            "accuracy": r.accuracy,
            "loss": r.loss,
            "f1_score": r.f1_score,
            "auc": r.auc,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None
        })

    return {
        "status": "success",
        "total": total_count,
        "page": page,
        "limit": limit,
        "data": data
    }


@router.get("/logs", status_code=status.HTTP_200_OK)
def get_training_logs(current_user = Depends(get_current_user)):
    """
    Get the active training logs from models/training.log.
    """
    import os
    log_path = "models/training.log"
    if not os.path.exists(log_path):
        return {
            "status": "idle",
            "logs": "Hệ thống đang rảnh. Chưa bắt đầu huấn luyện."
        }
        
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            logs = f.read()
    except Exception as e:
        logs = f"Error reading log file: {str(e)}"
        
    status_str = "running" if getattr(TrainingService, "is_training_active", False) else "idle"
    
    return {
        "status": status_str,
        "logs": logs
    }


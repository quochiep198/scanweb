from fastapi import APIRouter, Depends, status, HTTPException
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


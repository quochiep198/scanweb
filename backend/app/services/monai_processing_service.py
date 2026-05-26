import numpy as np
import torch
from monai.transforms import (
    Compose,
    Resize,
    NormalizeIntensity,
    RandRotate,
    RandZoom,
    RandGaussianNoise,
    ToTensor
)
import logging

logger = logging.getLogger(__name__)

class MonaiProcessingService:
    @staticmethod
    def get_transforms(use_augmentation: bool = True):
        """
        Creates MONAI preprocessing and augmentation pipeline.
        According to section 3.3.4 of spec-pack.md.
        """
        if use_augmentation:
            return Compose([
                # Resize to 300x300 for EfficientNet-B3
                Resize(spatial_size=(300, 300)),
                NormalizeIntensity(),
                RandRotate(range_x=0.1, prob=0.5),
                RandZoom(min_zoom=0.9, max_zoom=1.1, prob=0.5),
                RandGaussianNoise(prob=0.3, mean=0.0, std=0.1),
                ToTensor()
            ])
        else:
            # Baseline preprocessing without random augmentations (e.g. for validation/testing)
            return Compose([
                Resize(spatial_size=(300, 300)),
                NormalizeIntensity(),
                ToTensor()
            ])

    @staticmethod
    def process_image(img_array: np.ndarray, use_augmentation: bool = True) -> torch.Tensor:
        """
        Processes a NumPy image array using the MONAI pipeline.
        Expects shape (C, H, W). Adds channel or transposes if needed.
        """
        try:
            # Check dimensions and convert to Channel-First (C, H, W)
            if len(img_array.shape) == 2:
                img_array = img_array[None, :, :] # Add channel dimension
            elif len(img_array.shape) == 3:
                # If channel dimension is last, transpose to (C, H, W)
                # Usually standard image is (H, W, C) where C is 3 or 4
                if img_array.shape[2] in (1, 3, 4) and img_array.shape[0] not in (1, 3, 4):
                    img_array = img_array.transpose(2, 0, 1)
            
            transform_pipeline = MonaiProcessingService.get_transforms(use_augmentation)
            processed_tensor = transform_pipeline(img_array)
            return processed_tensor
        except Exception as e:
            logger.error(f"Error processing image with MONAI transforms: {e}")
            raise e

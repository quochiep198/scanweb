import numpy as np
import torch
import torchxrayvision as xrv
import torchvision.transforms as transforms
import logging

logger = logging.getLogger(__name__)

# Preload DenseNet model for efficient reuse
_model = None

def get_densenet_model():
    global _model
    if _model is None:
        logger.info("Loading pretrained TorchXRayVision DenseNet-121 model...")
        # Load DenseNet pre-trained on all datasets
        _model = xrv.models.DenseNet(weights="densenet121-res224-all")
        _model.eval() # Set to evaluation mode
        logger.info("DenseNet-121 loaded successfully.")
    return _model

class XRayAnalyzerService:
    @staticmethod
    def preprocess_xray(img_array: np.ndarray) -> np.ndarray:
        """
        Preprocesses a NumPy image array using TorchXRayVision standards.
        - Converts to grayscale if color.
        - Normalizes pixel values to [-1024, 1024].
        - Center crops and resizes to 224x224 using TorchXRayVision resizer.
        Returns a preprocessed NumPy array of shape (1, 224, 224).
        """
        try:
            # 1. Convert to grayscale if it has multiple channels
            if len(img_array.shape) == 3:
                # If RGBA, slice first 3 channels
                if img_array.shape[2] == 4:
                    img_array = img_array[:, :, :3]
                # Average channels to get grayscale
                img_array = img_array.mean(axis=2)
            
            img_array = img_array.astype(np.float32)
            
            # 2. Normalize to [-1024, 1024] using xrv.datasets.normalize
            # Check current range
            min_val = img_array.min()
            max_val = img_array.max()
            current_range = max_val - min_val
            
            if current_range > 0:
                # Scale to [0, 255] first
                img_array = ((img_array - min_val) / current_range) * 255.0
            else:
                img_array = np.zeros_like(img_array)
            
            normalized_img = xrv.datasets.normalize(img_array, 255.0)
            
            # Add channel dimension: expects (1, H, W)
            normalized_img = normalized_img[None, :, :]
            
            # 3. Apply TorchXRayVision center crop and resizer (224x224)
            transform = transforms.Compose([
                xrv.datasets.XRayCenterCrop(),
                xrv.datasets.XRayResizer(224)
            ])
            
            processed_img = transform(normalized_img)
            return processed_img
        except Exception as e:
            logger.error(f"Error preprocessing X-ray image with TorchXRayVision: {e}")
            raise e

    @staticmethod
    def analyze_features(processed_img: np.ndarray) -> dict:
        """
        Runs the preprocessed X-ray image array through the pretrained DenseNet-121 model.
        Extracts feature representations and pathology predictions.
        """
        try:
            model = get_densenet_model()
            
            # Convert NumPy array to PyTorch Tensor: shape (1, 1, 224, 224)
            tensor = torch.from_numpy(processed_img).unsqueeze(0)
            
            with torch.no_grad():
                # Extract features (representation layer)
                features = model.features(tensor)
                feature_shape = list(features.shape)
                
                # Get model pathology predictions (18 different conditions)
                outputs = model(tensor)
                
                # Zip model pathologies with predictions
                pathologies = model.pathologies
                predictions = outputs[0].detach().cpu().numpy()
                
                # Map pathology list to float predictions
                results_dict = {
                    pathology: float(predictions[i])
                    for i, pathology in enumerate(pathologies)
                }
                
                return {
                    "feature_shape": feature_shape,
                    "predictions": results_dict
                }
        except Exception as e:
            logger.error(f"Error executing DenseNet-121 analysis: {e}")
            raise e

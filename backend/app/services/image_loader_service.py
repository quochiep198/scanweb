import io
import pydicom
import numpy as np
from PIL import Image
import logging

logger = logging.getLogger(__name__)

class ImageLoaderService:
    @staticmethod
    def load_image_to_numpy(image_bytes: bytes, filename: str) -> np.ndarray:
        """
        Parses raw image bytes into a NumPy array based on the file extension.
        Supports DICOM (.dcm), PNG, and JPG/JPEG.
        """
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        
        try:
            if ext == "dcm":
                # Read DICOM using pydicom from memory
                dicom_data = pydicom.dcmread(io.BytesIO(image_bytes))
                # Retrieve the raw pixel array
                pixel_array = dicom_data.pixel_array
                return np.array(pixel_array, dtype=np.float32)
            else:
                # Read standard image format (PNG, JPG, JPEG) using Pillow
                img = Image.open(io.BytesIO(image_bytes))
                return np.array(img)
        except Exception as e:
            logger.error(f"Failed to load image to numpy for file {filename}: {e}")
            raise e

import io
import logging
import pydicom
import numpy as np
from PIL import Image, ImageOps, ImageDraw

logger = logging.getLogger(__name__)

_ocr_reader = None

def get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        # Load English and Vietnamese models
        _ocr_reader = easyocr.Reader(['vi', 'en'], gpu=False)
    return _ocr_reader

class AnonymizeService:
    @staticmethod
    def redact_burned_text(image: Image.Image) -> Image.Image:
        try:
            # Convert PIL image to numpy array for EasyOCR
            width, height = image.size
            max_dim = 1000
            if width > max_dim or height > max_dim:
                scale = max_dim / float(max(width, height))
                new_width = int(width * scale)
                new_height = int(height * scale)
                try:
                    resample_filter = Image.Resampling.LANCZOS
                except AttributeError:
                    resample_filter = Image.LANCZOS
                resized_image = image.resize((new_width, new_height), resample_filter)
            else:
                scale = 1.0
                resized_image = image

            img_array = np.array(resized_image.convert("RGB"))
            
            # Get OCR Reader and detect text
            reader = get_ocr_reader()
            results = reader.readtext(img_array)
            
            # Draw bounding boxes containing text directly on the original image
            draw = ImageDraw.Draw(image)
            img_area = width * height
            
            for (bbox, text, prob) in results:
                # Skip low confidence detections
                if prob < 0.45:
                    continue
                    
                pts = np.array(bbox, np.int32)
                x_min = max(0, int(np.min(pts[:, 0])))
                y_min = max(0, int(np.min(pts[:, 1])))
                x_max = min(resized_image.width, int(np.max(pts[:, 0])))
                y_max = min(resized_image.height, int(np.max(pts[:, 1])))
                
                # Scale coordinates back to original size
                orig_x_min = max(0, int(x_min / scale))
                orig_y_min = max(0, int(y_min / scale))
                orig_x_max = min(width, int(x_max / scale))
                orig_y_max = min(height, int(y_max / scale))
                
                # Calculate box dimensions on the original scale
                box_width = orig_x_max - orig_x_min
                box_height = orig_y_max - orig_y_min
                box_area = box_width * box_height
                
                if box_area > (img_area * 0.05): # Text shouldn't take > 5% of total image
                    continue
                if box_height > (height * 0.1): # Text height shouldn't be > 10% of image height
                    continue
                
                # Apply blackout rectangle to completely obscure text on original image
                draw.rectangle([orig_x_min, orig_y_min, orig_x_max, orig_y_max], fill="black")

            return image
        except Exception as e:
            logger.warning(f"OCR Redaction warning: {e}")
        
        return image

    @staticmethod
    def anonymize_image(file_content: bytes, filename: str) -> bytes:
        """
        Anonymizes patient information (PHI) in x-ray scans.
        Supports DICOM (.dcm) metadata tags removal and standard images (.png, .jpg, .jpeg) EXIF stripping + OCR text redaction.
        """
        filename_lower = filename.lower() if filename else ""
        try:
            if filename_lower.endswith(".dcm"):
                dicom_data = pydicom.dcmread(io.BytesIO(file_content))
                tags_to_anonymize = [
                    'PatientName', 'PatientID', 'PatientBirthDate', 'PatientSex', 'PatientAge',
                    'InstitutionName', 'InstitutionAddress', 'InstitutionalDepartmentName',
                    'PhysiciansOfRecord', 'PerformingPhysicianName', 'OperatorsName', 'ReferringPhysicianName',
                    'StudyDate', 'SeriesDate', 'AcquisitionDate', 'ContentDate',
                    'StudyTime', 'SeriesTime'
                ]
                for tag in tags_to_anonymize:
                    if tag in dicom_data:
                        delattr(dicom_data, tag)
                out_stream = io.BytesIO()
                dicom_data.save_as(out_stream)
                return out_stream.getvalue()
            elif filename_lower.endswith((".png", ".jpg", ".jpeg")):
                image = Image.open(io.BytesIO(file_content))
                
                # 1. Correct orientation from EXIF (if any) before stripping
                image = ImageOps.exif_transpose(image)
                
                # 2. Use OCR to remove burned-in text directly on PIL image
                image = AnonymizeService.redact_burned_text(image)
                
                # 3. Save keeping original profile but stripping EXIF
                fmt = "PNG" if filename_lower.endswith(".png") else "JPEG"
                if fmt == "JPEG" and image.mode in ("RGBA", "P"):
                    # JPEG doesn't support alpha channel, convert to RGB
                    image = image.convert("RGB")
                    
                out_stream = io.BytesIO()
                icc_profile = image.info.get("icc_profile")
                # Save with 100% quality to avoid degradation
                image.save(out_stream, format=fmt, quality=100, icc_profile=icc_profile)
                
                return out_stream.getvalue()
        except Exception as e:
            logger.error(f"Failed to anonymize image data for file {filename}: {e}")
            raise e
        
        return file_content

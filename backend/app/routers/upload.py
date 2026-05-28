from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.scan_zone import ScanZone
from app.models.diagnostic_label import DiagnosticLabel
from app.schemas.upload import UploadOptionsResponse
from app.services.r2_service import R2Service
from app.services.upload_service import UploadService
from datetime import datetime
import io
from PIL import Image, ImageOps, ImageDraw
import pydicom
import numpy as np

_ocr_reader = None

def get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        # Load English and Vietnamese models
        _ocr_reader = easyocr.Reader(['vi', 'en'], gpu=False)
    return _ocr_reader

def redact_burned_text(image: Image.Image) -> Image.Image:
    try:
        # Convert PIL image to numpy array for EasyOCR
        # EasyOCR works best with RGB, so we convert a copy to RGB safely
        img_array = np.array(image.convert("RGB"))
        
        # Get OCR Reader and detect text
        reader = get_ocr_reader()
        results = reader.readtext(img_array)
        
        # Blur bounding boxes containing text
        draw = ImageDraw.Draw(image)
        img_area = image.width * image.height
        
        for (bbox, text, prob) in results:
            # Skip low confidence detections
            if prob < 0.45:
                continue
                
            pts = np.array(bbox, np.int32)
            x_min = max(0, int(np.min(pts[:, 0])))
            y_min = max(0, int(np.min(pts[:, 1])))
            x_max = min(image.width, int(np.max(pts[:, 0])))
            y_max = min(image.height, int(np.max(pts[:, 1])))
            
            # Skip unreasonably large bounding boxes (false positives on bones)
            box_width = x_max - x_min
            box_height = y_max - y_min
            box_area = box_width * box_height
            
            if box_area > (img_area * 0.05): # Text shouldn't take > 5% of total image
                continue
            if box_height > (image.height * 0.1): # Text height shouldn't be > 10% of image height
                continue
            
            # Apply blackout rectangle to completely obscure text
            draw.rectangle([x_min, y_min, x_max, y_max], fill="black")

        return image
    except Exception as e:
        print(f"OCR Redaction warning: {e}")
    
    return image

router = APIRouter(prefix="/v1/upload", tags=["Upload"])

@router.get("/options", response_model=UploadOptionsResponse)
def get_upload_options(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Retrieve Scan Zones and Diagnostic Labels dynamically from database."""
    scan_zones = db.query(ScanZone).all()
    diagnostic_labels = db.query(DiagnosticLabel).all()
    return {
        "scan_zones": scan_zones,
        "diagnostic_labels": diagnostic_labels
    }

def to_int(val: str) -> int | None:
    if not val or val.strip() == "":
        return None
    try:
        return int(val)
    except ValueError:
        return None

def to_float(val: str) -> float | None:
    if not val or val.strip() == "":
        return None
    try:
        return float(val)
    except ValueError:
        return None

def to_date(val: str):
    if not val or val.strip() == "":
        return None
    try:
        return datetime.strptime(val.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None

def map_label(val: str) -> str:
    if not val:
        return "normal"
    v = val.strip().lower()
    if v in ("binh thuong", "bình thường", "normal"):
        return "normal"
    if v in ("thieu xuong", "thiếu xương", "osteopenia"):
        return "osteopenia"
    if v in ("lo xuong", "lở xương", "loãng xương", "osteoporosis"):
        return "osteoporosis"
    return v

def map_body_part(val: str) -> str:
    if not val:
        return "other"
    v = val.strip().lower()
    if v in ("cột sống thắt lưng", "cot song that lung", "lumbar_spine"):
        return "lumbar_spine"
    if v in ("xương đùi", "xuong dui", "femoral_neck", "hip"):
        return "femoral_neck"
    if v in ("toàn thân", "toan than", "other"):
        return "other"
    return v

def map_view_type(val: str) -> str:
    if not val:
        return "Other"
    v = val.strip().lower()
    if v in ("ap", "trước - sau", "truoc - sau"):
        return "AP"
    if v in ("lateral", "nghiêng", "nghieng"):
        return "Lateral"
    if v in ("pa", "sau - trước", "sau - truoc"):
        return "PA"
    if v in ("other", "khác", "khac"):
        return "Other"
    return val.strip()

def map_dxa_site(val: str) -> str:
    if not val:
        return "other"
    v = val.strip().lower()
    if v in ("cột sống thắt lưng", "cot song that lung", "lumbar_spine"):
        return "lumbar_spine"
    if v in ("cổ xương đùi", "co xuong dui", "femoral_neck"):
        return "femoral_neck"
    if v in ("khớp háng toàn phần", "khop hang toan phan", "total_hip"):
        return "total_hip"
    if v in ("cẳng tay", "cang tay", "forearm"):
        return "forearm"
    if v in ("vị trí khác", "vi tri khac", "other"):
        return "other"
    return v

@router.post("", status_code=status.HTTP_201_CREATED)
def upload_file(
    file: UploadFile = File(...),
    anonymous_code: str = Form(...),
    age: str = Form(None),
    sex: str = Form(None),
    height_cm: str = Form(None),
    weight_kg: str = Form(None),
    bmi: str = Form(None),
    xray_date: str = Form(None),
    view_type: str = Form(None),
    body_part: str = Form(None),
    scanner_vendor: str = Form(None),
    pixel_spacing: str = Form(None),
    image_quality: str = Form(None),
    label: str = Form(...),
    t_score: str = Form(None),
    bmd: str = Form(None),
    dxa_site: str = Form(None),
    dxa_date: str = Form(None),
    label_source: str = Form(None),
    dataset_split: str = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Uploads a file to R2 and registers patient, xray, and osteoporosis label.
    """
    # 1. Read file content
    try:
        file_content = file.file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read uploaded file: {str(e)}"
        )

    # Calculate SHA-256 hash to check for duplicate uploads
    import hashlib
    image_hash = hashlib.sha256(file_content).hexdigest()
    
    from app.models.xray_image import XRayImage
    duplicate = db.query(XRayImage).filter(XRayImage.image_hash == image_hash).first()
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File anh nay da ton tai trong he thong."
        )

    # 1.5 Anonymize Patient Information (PHI)
    try:
        filename_lower = file.filename.lower() if file.filename else ""
        if filename_lower.endswith(".dcm"):
            dicom_data = pydicom.dcmread(io.BytesIO(file_content))
            tags_to_anonymize = [
                'PatientName', 'PatientID', 'PatientBirthDate', 'PatientSex', 'PatientAge',
                'InstitutionName', 'InstitutionAddress', 'InstitutionalDepartmentName',
                'PhysiciansOfRecord', 'PerformingPhysicianName', 'OperatorsName', 'ReferringPhysicianName'
            ]
            for tag in tags_to_anonymize:
                if tag in dicom_data:
                    delattr(dicom_data, tag)
            out_stream = io.BytesIO()
            dicom_data.save_as(out_stream)
            file_content = out_stream.getvalue()
        elif filename_lower.endswith((".png", ".jpg", ".jpeg")):
            image = Image.open(io.BytesIO(file_content))
            
            # 1. Correct orientation from EXIF (if any) before stripping
            image = ImageOps.exif_transpose(image)
            
            # 2. Use OCR to remove burned-in text directly on PIL image
            image = redact_burned_text(image)
            
            # 3. Save keeping original profile but stripping EXIF
            fmt = "PNG" if filename_lower.endswith(".png") else "JPEG"
            if fmt == "JPEG" and image.mode in ("RGBA", "P"):
                # JPEG doesn't support alpha channel, convert to RGB
                image = image.convert("RGB")
                
            out_stream = io.BytesIO()
            icc_profile = image.info.get("icc_profile")
            # Save with 100% quality to avoid degradation
            image.save(out_stream, format=fmt, quality=100, icc_profile=icc_profile)
            
            file_content = out_stream.getvalue()
    except Exception as e:
        # If anonymization fails, we continue with original file or raise an error depending on strictness.
        # Since patient privacy is critical, we'll raise an error if parsing fails to avoid leaking PHI.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to anonymize image data: {str(e)}"
        )

    # 2. Upload to Cloudflare R2
    try:
        image_path = R2Service.upload_file(file_content, file.filename, file.content_type)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to upload image to Cloudflare R2: {str(e)}"
        )

    # 3. Save metadata to database
    try:
        # Map values & validate types
        age_int = to_int(age)
        height_val = to_float(height_cm)
        weight_val = to_float(weight_kg)
        bmi_val = to_float(bmi)
        pixel_spacing_val = to_float(pixel_spacing)
        t_score_val = to_float(t_score)
        bmd_val = to_float(bmd)
        
        xray_date_val = to_date(xray_date)
        dxa_date_val = to_date(dxa_date)

        # Convert empty strings to None for enums/strings and map to valid database enums
        sex_val = sex.strip() if sex and sex.strip() != "" else None
        view_type_val = map_view_type(view_type) if view_type else None
        body_part_val = map_body_part(body_part) if body_part else None
        scanner_vendor_val = scanner_vendor.strip() if scanner_vendor and scanner_vendor.strip() != "" else None
        image_quality_val = image_quality.strip() if image_quality and image_quality.strip() != "" else None
        label_val = map_label(label) if label else None
        dxa_site_val = map_dxa_site(dxa_site) if dxa_site else None
        label_source_val = label_source.strip() if label_source and label_source.strip() != "" else "DXA"
        dataset_split_val = dataset_split.strip() if dataset_split and dataset_split.strip() != "" else None

        xray_image = UploadService.register_upload(
            db=db,
            anonymous_code=anonymous_code.strip(),
            age=age_int,
            sex=sex_val,
            height_cm=height_val,
            weight_kg=weight_val,
            bmi=bmi_val,
            image_path=image_path,
            xray_date=xray_date_val,
            view_type=view_type_val,
            body_part=body_part_val,
            scanner_vendor=scanner_vendor_val,
            pixel_spacing=pixel_spacing_val,
            image_quality=image_quality_val,
            label=label_val,
            t_score=t_score_val,
            bmd=bmd_val,
            dxa_site=dxa_site_val,
            dxa_date=dxa_date_val,
            label_source=label_source_val,
            dataset_split=dataset_split_val,
            source="internal",
            image_hash=image_hash
        )
        return {
            "status": "success",
            "message": "Registered successfully",
            "image_id": xray_image.image_id,
            "image_path": xray_image.image_path
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database registration failed: {str(e)}"
        )

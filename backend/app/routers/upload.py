from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.scan_zone import ScanZone
from app.models.diagnostic_label import DiagnosticLabel
from app.schemas.upload import UploadOptionsResponse
from app.services.r2_service import R2Service
from app.services.upload_service import UploadService
from app.services.anonymize_service import AnonymizeService
from datetime import datetime
import io
from PIL import Image, ImageOps, ImageDraw
import pydicom
import numpy as np



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
        file_content = AnonymizeService.anonymize_image(file_content, file.filename)
    except Exception as e:
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

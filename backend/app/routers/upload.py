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

        # Convert empty strings to None for enums/strings
        sex_val = sex.strip() if sex and sex.strip() != "" else None
        view_type_val = view_type.strip() if view_type and view_type.strip() != "" else None
        body_part_val = body_part.strip() if body_part and body_part.strip() != "" else None
        scanner_vendor_val = scanner_vendor.strip() if scanner_vendor and scanner_vendor.strip() != "" else None
        image_quality_val = image_quality.strip() if image_quality and image_quality.strip() != "" else None
        label_val = label.strip() if label and label.strip() != "" else None
        dxa_site_val = dxa_site.strip() if dxa_site and dxa_site.strip() != "" else None
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
            dataset_split=dataset_split_val
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

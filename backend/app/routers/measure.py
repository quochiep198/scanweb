from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.services.measure_service import MeasureService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/measure", tags=["Measurement"])

@router.post("/predict", status_code=status.HTTP_200_OK)
def predict_osteoporosis(
    file: UploadFile = File(...),
    age: str = Form(...),
    sex: str = Form(...),
    bmi: str = Form(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 1. Validate file exists
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng chọn ảnh cần phân tích"
        )
        
    # 2. Validate file format
    filename_lower = file.filename.lower()
    allowed_extensions = (".dcm", ".png", ".jpg", ".jpeg")
    if not filename_lower.endswith(allowed_extensions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File không đúng định dạng"
        )
        
    # 3. Read and validate file size
    try:
        file_content = file.file.read()
    except Exception as e:
        logger.error(f"Error reading file bytes: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không đọc được ảnh upload"
        )
        
    if len(file_content) > 50 * 1024 * 1024: # 50MB
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File vượt quá dung lượng cho phép"
        )

    # 4. Validate metadata
    try:
        age_int = int(age.strip())
        if age_int <= 0:
            raise ValueError()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập đầy đủ thông tin phân tích (Tuổi phải là số nguyên dương)"
        )

    sex_str = sex.strip().upper()
    if sex_str not in ("M", "F", "OTHER"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập đầy đủ thông tin phân tích (Giới tính không hợp lệ)"
        )

    try:
        bmi_float = float(bmi.strip())
        if bmi_float <= 0.0:
            raise ValueError()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập đầy đủ thông tin phân tích (BMI phải là số thực dương)"
        )

    # 5. Execute Prediction
    try:
        result = MeasureService.predict(
            db=db,
            user_id=current_user.id,
            file_content=file_content,
            filename=file.filename,
            age=age_int,
            sex=sex_str,
            bmi=bmi_float
        )
        return {
            "success": True,
            "message": "Phân tích kết quả thành công",
            "data": result
        }
    except FileNotFoundError as e:
        logger.error(f"Prediction failed - model not found: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy model dự đoán"
        )
    except Exception as e:
        logger.error(f"Prediction failed during inference pipeline: {e}")
        err_msg = str(e)
        if "state_dict" in err_msg or "load" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tải model dự đoán"
            )
        elif "MONAI" in err_msg or "preprocess" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Xử lý ảnh thất bại"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Phân tích kết quả thất bại"
            )

from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, status, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
import logging

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.services.measure_service import MeasureService
from app.models.measurement_result import MeasurementResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/measure", tags=["Measurement"])

class ConfirmReviewRequest(BaseModel):
    review_status: str = Field(..., description="Trạng thái review (confirmed_correct, corrected_by_doctor, rejected, uncertain)")
    doctor_confirmed_label: Optional[str] = Field(None, description="Nhãn do bác sĩ chọn (normal, osteopenia, osteoporosis)")
    error_type: Optional[str] = Field("none", description="Loại lỗi (none, under_prediction, over_prediction, poor_image_quality, wrong_input, uncertain, other)")
    approved_for_next_training: bool = Field(False, description="Có duyệt đưa vào tập train tiếp theo không")
    review_note: Optional[str] = Field(None, description="Ghi chú lâm sàng của bác sĩ")

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
    except ValueError as e:
        logger.error(f"Prediction failed due to validation: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
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

@router.put("/confirm/{measurement_id}", status_code=status.HTTP_200_OK)
def confirm_measurement_result(
    measurement_id: int,
    req_body: ConfirmReviewRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        # Perform review confirm using Service
        updated_result = MeasureService.confirm_review(
            db=db,
            measurement_id=measurement_id,
            review_status=req_body.review_status,
            doctor_confirmed_label=req_body.doctor_confirmed_label,
            error_type=req_body.error_type,
            approved_for_next_training=req_body.approved_for_next_training,
            review_note=req_body.review_note,
            reviewer_id=current_user.id
        )
        return {
            "success": True,
            "message": "Xác nhận kết quả phân tích thành công",
            "data": {
                "measurement_id": updated_result.measurement_id,
                "review_status": updated_result.review_status,
                "doctor_confirmed_label": updated_result.doctor_confirmed_label,
                "is_ai_correct": updated_result.is_ai_correct,
                "image_r2_key": updated_result.image_r2_key
            }
        }
    except FileNotFoundError as e:
        logger.error(f"Review confirm failed - record not found: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValueError as e:
        logger.error(f"Review confirm failed - invalid values: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Review confirm failed due to internal error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Xác nhận kết quả thất bại"
        )

@router.get("/{measurement_id}/heatmap", status_code=status.HTTP_200_OK)
def get_measurement_heatmap(
    measurement_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Downloads the heatmap PNG bytes from Cloudflare R2 and serves it directly as an image response.
    """
    db_result = db.query(MeasurementResult).filter(
        MeasurementResult.measurement_id == measurement_id,
        MeasurementResult.user_id == current_user.id
    ).first()
    
    if not db_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy kết quả phân tích"
        )
        
    if not db_result.image_heatmap_r2_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bản ghi này chưa có ảnh bản đồ nhiệt"
        )
        
    try:
        from app.services.r2_service import R2Service
        image_bytes = R2Service.download_file(db_result.image_heatmap_r2_key)
        return Response(content=image_bytes, media_type="image/png")
    except Exception as e:
        logger.error(f"Error downloading heatmap from R2 for ID {measurement_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể tải ảnh bản đồ nhiệt từ R2"
        )

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models import XRayImage, MeasurementResult

router = APIRouter(prefix="/v1/dashboard", tags=["Dashboard"])

@router.get("/stats", status_code=status.HTTP_200_OK)
def get_dashboard_stats(
    page: int = 1,
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Retrieve operations statistics for the dashboard:
    - Count of xray_images uploaded today.
    - Count of xray_images trained today.
    - Count of total xray_images.
    - Diagnosis distribution (normal, osteopenia, osteoporosis) from measurement_results.
    - AI review stats (agreement rate).
    - Recent 5 scan records.
    """
    today = date.today()
    
    # 1. Count uploads today
    upload_today_count = (
        db.query(XRayImage)
        .filter(XRayImage.created_at == today)
        .count()
    )
    
    # 2. Count trained today
    trained_today_count = (
        db.query(XRayImage)
        .filter(XRayImage.is_trained == True)
        .filter(XRayImage.trained_date == today)
        .count()
    )

    # 3. Count uploads
    upload_count = (
        db.query(XRayImage)
        .count()
    )

    # 4. Count diagnosis distribution (from MeasurementResult)
    dist_query = (
        db.query(
            MeasurementResult.predicted_label,
            func.count(MeasurementResult.measurement_id)
        )
        .group_by(MeasurementResult.predicted_label)
        .all()
    )
    
    distribution = {
        "normal": 0,
        "osteopenia": 0,
        "osteoporosis": 0
    }
    for label, count in dist_query:
        if label:
            # label is an Enum, get its string value if applicable, otherwise convert to str
            label_key = label.value if hasattr(label, 'value') else str(label)
            if label_key in distribution:
                distribution[label_key] = count

    # 5. Doctor review agreement rate
    total_reviewed = (
        db.query(MeasurementResult)
        .filter(MeasurementResult.review_status.in_(["confirmed_correct", "corrected_by_doctor"]))
        .count()
    )
    
    agreement_count = (
        db.query(MeasurementResult)
        .filter(
            (MeasurementResult.review_status == "confirmed_correct") |
            ((MeasurementResult.review_status == "corrected_by_doctor") & (MeasurementResult.is_ai_correct == True))
        )
        .count()
    )
    
    agreement_rate = 0.0
    if total_reviewed > 0:
        agreement_rate = round((agreement_count / total_reviewed) * 100, 1)

    # 6. Recent measurements with pagination
    offset = (page - 1) * limit
    recent_measurements_query = (
        db.query(MeasurementResult)
        .order_by(MeasurementResult.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    total_measurements = db.query(MeasurementResult).count()
    
    recent_measurements = []
    for m in recent_measurements_query:
        recent_measurements.append({
            "measurement_id": m.measurement_id,
            "image_filename": m.image_filename,
            "age": m.age,
            "sex": m.sex.value if hasattr(m.sex, 'value') else m.sex,
            "bmi": float(m.bmi) if m.bmi is not None else None,
            "predicted_label": m.predicted_label.value if hasattr(m.predicted_label, 'value') else m.predicted_label,
            "confidence": float(m.confidence) if m.confidence is not None else None,
            "predicted_t_score": float(m.predicted_t_score) if m.predicted_t_score is not None else None,
            "review_status": m.review_status,
            "doctor_confirmed_label": m.doctor_confirmed_label,
            "created_at": m.created_at.isoformat() if m.created_at else None
        })

    return {
        "upload_today_count": upload_today_count,
        "trained_today_count": trained_today_count,
        "upload_count": upload_count,
        "distribution": distribution,
        "agreement_rate": agreement_rate,
        "total_reviewed": total_reviewed,
        "recent_measurements": recent_measurements,
        "total_measurements": total_measurements
    }



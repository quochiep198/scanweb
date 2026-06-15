from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models import XRayImage, MeasurementResult, TrainingHistory
from app.core.config import settings

router = APIRouter(prefix="/v1/dashboard", tags=["Dashboard"])

@router.get("/stats", status_code=status.HTTP_200_OK)
def get_dashboard_stats(
    page: int = 1,
    limit: int = 5,
    search: str = None,
    status: str = None,
    label: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Retrieve operations statistics for the dashboard:
    - Count of xray_images uploaded today & yesterday.
    - Count of xray_images trained today & yesterday.
    - Count of total xray_images.
    - Diagnosis distribution (normal, osteopenia, osteoporosis) from measurement_results.
    - AI review stats (agreement rate).
    - Recent scan records with search & filters & pagination.
    - Active AI model details from TrainingHistory.
    """
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    # 1. Count uploads today & yesterday
    upload_today_count = (
        db.query(XRayImage)
        .filter(XRayImage.created_at == today)
        .count()
    )
    upload_yesterday_count = (
        db.query(XRayImage)
        .filter(XRayImage.created_at == yesterday)
        .count()
    )
    
    # 2. Count trained today & yesterday
    trained_today_count = (
        db.query(XRayImage)
        .filter(XRayImage.is_trained == True)
        .filter(XRayImage.trained_date == today)
        .count()
    )
    trained_yesterday_count = (
        db.query(XRayImage)
        .filter(XRayImage.is_trained == True)
        .filter(XRayImage.trained_date == yesterday)
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
    for label_item, count in dist_query:
        if label_item:
            # label_item is an Enum, get its string value if applicable, otherwise convert to str
            label_key = label_item.value if hasattr(label_item, 'value') else str(label_item)
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

    # 6. Active model information from TrainingHistory
    latest_training = (
        db.query(TrainingHistory)
        .filter(TrainingHistory.status == "success")
        .order_by(TrainingHistory.completed_at.desc())
        .first()
    )
    
    active_model_version = settings.ACTIVE_MODEL_VERSION
    active_model_accuracy = 0.885  # Default baseline if no history
    active_model_f1_score = 0.872   # Default baseline if no history
    active_model_trained_date = None
    
    if latest_training:
        active_model_version = latest_training.run_name
        active_model_accuracy = float(latest_training.accuracy) if latest_training.accuracy is not None else active_model_accuracy
        active_model_f1_score = float(latest_training.f1_score) if latest_training.f1_score is not None else active_model_f1_score
        active_model_trained_date = latest_training.completed_at.isoformat() if latest_training.completed_at else None

    # 7. Recent measurements with pagination, search & filters
    offset = (page - 1) * limit
    query = db.query(MeasurementResult)
    
    if search:
        search_clean = search.strip()
        if search_clean:
            if search_clean.isdigit():
                query = query.filter(
                    (MeasurementResult.measurement_id == int(search_clean)) |
                    (MeasurementResult.age == int(search_clean))
                )
            else:
                query = query.filter(MeasurementResult.image_filename.ilike(f"%{search_clean}%"))
                
    if status and status != "all":
        query = query.filter(MeasurementResult.review_status == status)
        
    if label and label != "all":
        query = query.filter(MeasurementResult.predicted_label == label)
        
    total_measurements = query.count()
    
    recent_measurements_query = (
        query.order_by(MeasurementResult.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
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
        "upload_yesterday_count": upload_yesterday_count,
        "trained_today_count": trained_today_count,
        "trained_yesterday_count": trained_yesterday_count,
        "upload_count": upload_count,
        "distribution": distribution,
        "agreement_rate": agreement_rate,
        "total_reviewed": total_reviewed,
        "recent_measurements": recent_measurements,
        "total_measurements": total_measurements,
        "active_model_version": active_model_version,
        "active_model_accuracy": active_model_accuracy,
        "active_model_f1_score": active_model_f1_score,
        "active_model_trained_date": active_model_trained_date
    }




from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from datetime import date

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.xray_image import XRayImage

router = APIRouter(prefix="/v1/dashboard", tags=["Dashboard"])

@router.get("/stats", status_code=status.HTTP_200_OK)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Retrieve operations statistics for the dashboard:
    - Count of xray_images uploaded today.
    - Count of xray_images trained today.
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
    
    return {
        "upload_today_count": upload_today_count,
        "trained_today_count": trained_today_count
    }

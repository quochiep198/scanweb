from sqlalchemy import Column, String, Integer, Numeric, Enum, Date, ForeignKey, Boolean, func
from app.core.database import Base

class XRayImage(Base):
    __tablename__ = "xray_images"

    image_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.patient_id"), nullable=False)
    image_path = Column(String(500), nullable=False)
    xray_date = Column(Date, nullable=True)
    view_type = Column(Enum('AP', 'Lateral', 'PA', 'Other', name='view_types'), nullable=True)
    body_part = Column(Enum('lumbar_spine', 'hip', 'femoral_neck', 'pelvis', 'other', name='body_parts'), nullable=True)
    scanner_vendor = Column(String(100), nullable=True)
    pixel_spacing = Column(Numeric(8, 5), nullable=True)
    image_quality = Column(Enum('excellent', 'good', 'acceptable', 'poor', name='image_qualities'), nullable=True)
    is_trained = Column(Boolean, default=False, nullable=False)
    created_at = Column(Date, default=func.current_date(), nullable=False)
    trained_date = Column(Date, nullable=True)
    source = Column(String(50), default="internal", nullable=False)
    dataset_split = Column(String(50), nullable=True)
    image_hash = Column(String(64), unique=True, nullable=True)

from sqlalchemy import Column, Integer, Numeric, Enum, DateTime, String, ForeignKey, Boolean, Text
from sqlalchemy.sql import func
from app.core.database import Base

class MeasurementResult(Base):
    __tablename__ = "measurement_results"

    measurement_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    image_filename = Column(String(255), nullable=True)
    image_r2_key = Column(String(500), nullable=True)
    image_sha256_hash = Column(String(64), nullable=True)

    age = Column(Integer, nullable=True)
    sex = Column(Enum('M', 'F', 'Other', name='sex_types'), nullable=True)
    bmi = Column(Numeric(5, 2), nullable=True)

    predicted_label = Column(Enum('normal', 'osteopenia', 'osteoporosis', name='label_types'), nullable=False)
    confidence = Column(Numeric(6, 5), nullable=True)
    predicted_t_score = Column(Numeric(4, 2), nullable=True)

    normal_probability = Column(Numeric(6, 5), nullable=True)
    osteopenia_probability = Column(Numeric(6, 5), nullable=True)
    osteoporosis_probability = Column(Numeric(6, 5), nullable=True)

    doctor_confirmed_label = Column(String(50), nullable=True)
    is_ai_correct = Column(Boolean, nullable=True)
    review_status = Column(String(50), default='pending', nullable=True)
    error_type = Column(String(50), default='none', nullable=True)
    approved_for_next_training = Column(Boolean, default=False, nullable=True)
    review_note = Column(Text, nullable=True)
    reviewed_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    model_path = Column(String(500), nullable=True)
    model_version = Column(String(100), nullable=True)
    dataset_version = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

from sqlalchemy import Column, Integer, Numeric, Enum, DateTime, String, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class MeasurementResult(Base):
    __tablename__ = "measurement_results"

    measurement_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    image_filename = Column(String(255), nullable=True)
    age = Column(Integer, nullable=True)
    sex = Column(Enum('M', 'F', 'Other', name='sex_types'), nullable=True)
    bmi = Column(Numeric(5, 2), nullable=True)
    predicted_label = Column(Enum('normal', 'osteopenia', 'osteoporosis', name='label_types'), nullable=False)
    confidence = Column(Numeric(6, 5), nullable=True)
    normal_probability = Column(Numeric(6, 5), nullable=True)
    osteopenia_probability = Column(Numeric(6, 5), nullable=True)
    osteoporosis_probability = Column(Numeric(6, 5), nullable=True)
    model_path = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

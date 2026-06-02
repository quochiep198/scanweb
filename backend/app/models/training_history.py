from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class TrainingHistory(Base):
    __tablename__ = "training_history"

    id = Column(String(36), primary_key=True, index=True)
    run_name = Column(String(255), nullable=False)
    trainer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    status = Column(String(50), nullable=False) # 'running', 'success', 'failed'
    clinical_info = Column(Text, nullable=True) # Summary of clinical metadata
    dataset_size = Column(Integer, default=0)
    accuracy = Column(Float, nullable=True)
    loss = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    auc = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    trainer = relationship("User")

from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from app.core.database import Base
from sqlalchemy.sql import func

class TrainingLog(Base):
    __tablename__ = "training_logs"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String(36), ForeignKey("training_history.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

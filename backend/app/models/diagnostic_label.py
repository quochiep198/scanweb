from sqlalchemy import Column, Integer, String
from app.core.database import Base

class DiagnosticLabel(Base):
    __tablename__ = "diagnostic_labels"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    value = Column(String(255), nullable=False, unique=True, index=True)

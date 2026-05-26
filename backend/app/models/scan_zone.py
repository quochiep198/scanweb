from sqlalchemy import Column, Integer, String
from app.core.database import Base

class ScanZone(Base):
    __tablename__ = "scan_zones"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    value = Column(String(255), nullable=False, unique=True, index=True)

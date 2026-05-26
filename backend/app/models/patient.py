from sqlalchemy import Column, String, Integer, Numeric, Enum
from app.core.database import Base

class Patient(Base):
    __tablename__ = "patients"

    patient_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    anonymous_code = Column(String(100), unique=True, index=True, nullable=False)
    age = Column(Integer, nullable=True)
    sex = Column(Enum('M', 'F', 'Other', name='sex_types'), nullable=True)
    height_cm = Column(Numeric(5, 2), nullable=True)
    weight_kg = Column(Numeric(5, 2), nullable=True)
    bmi = Column(Numeric(5, 2), nullable=True)

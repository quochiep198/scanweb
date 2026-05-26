from sqlalchemy import Column, Integer, Numeric, Enum, Date, ForeignKey
from app.core.database import Base

class OsteoporosisLabel(Base):
    __tablename__ = "osteoporosis_labels"

    label_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    image_id = Column(Integer, ForeignKey("xray_images.image_id"), nullable=False)
    label = Column(Enum('normal', 'osteopenia', 'osteoporosis', name='label_types'), nullable=False)
    t_score = Column(Numeric(4, 2), nullable=True)
    bmd = Column(Numeric(6, 3), nullable=True)
    dxa_site = Column(Enum('lumbar_spine', 'femoral_neck', 'total_hip', 'forearm', 'other', name='dxa_sites'), nullable=True)
    dxa_date = Column(Date, nullable=True)
    label_source = Column(Enum('DXA', 'doctor', 'rule_based', name='label_sources'), default='DXA')
    dataset_split = Column(Enum('train', 'validation', 'test', name='dataset_splits'), nullable=True)

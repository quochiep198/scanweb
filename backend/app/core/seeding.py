import logging
from sqlalchemy.orm import Session
from app.models.scan_zone import ScanZone
from app.models.diagnostic_label import DiagnosticLabel
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)

def seed_data():
    db: Session = SessionLocal()
    try:
        # Seed ScanZones
        scan_zones = [
            {"name": "Cột sống thắt lưng", "value": "lumbar_spine"},
            {"name": "Xương đùi", "value": "femoral_neck"},
            {"name": "Toàn thân", "value": "other"},
        ]
        for sz in scan_zones:
            exists = db.query(ScanZone).filter(ScanZone.value == sz["value"]).first()
            if not exists:
                db.add(ScanZone(name=sz["name"], value=sz["value"]))
                logger.info(f"Seeded ScanZone: {sz['name']}")

        # Seed DiagnosticLabels
        diagnostic_labels = [
            {"name": "Bình thường", "value": "normal"},
            {"name": "Thiếu xương", "value": "osteopenia"},
            {"name": "Loãng xương", "value": "osteoporosis"},
        ]
        for dl in diagnostic_labels:
            exists = db.query(DiagnosticLabel).filter(DiagnosticLabel.value == dl["value"]).first()
            if not exists:
                db.add(DiagnosticLabel(name=dl["name"], value=dl["value"]))
                logger.info(f"Seeded DiagnosticLabel: {dl['name']}")

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding data: {e}")
    finally:
        db.close()

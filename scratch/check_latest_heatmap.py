import sys
import os
from dotenv import load_dotenv

# Load env
load_dotenv("backend/.env")
sys.path.append(os.path.abspath("backend"))

from app.core.database import SessionLocal
from app.models.measurement_result import MeasurementResult

def check():
    db = SessionLocal()
    try:
        results = db.query(MeasurementResult).order_by(MeasurementResult.created_at.desc()).limit(5).all()
        print(f"Latest {len(results)} results:")
        for r in results:
            print(f"ID: {r.measurement_id} | Created: {r.created_at} | File: {r.image_filename} | Heatmap Key: {r.image_heatmap_r2_key}")
    finally:
        db.close()

if __name__ == "__main__":
    check()

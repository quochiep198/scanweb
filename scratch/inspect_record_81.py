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
        r = db.query(MeasurementResult).filter(MeasurementResult.measurement_id == 81).first()
        if r:
            print(f"ID: {r.measurement_id}")
            print(f"Image R2 Key: {r.image_r2_key}")
            print(f"Heatmap Key: {r.image_heatmap_r2_key}")
            print(f"Confidence: {r.confidence}")
            print(f"Predicted T-Score: {r.predicted_t_score}")
        else:
            print("Record 81 not found.")
    finally:
        db.close()

if __name__ == "__main__":
    check()

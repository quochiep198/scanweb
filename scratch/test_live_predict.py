import sys
import os
import json
from dotenv import load_dotenv

# Load env variables from backend/.env
load_dotenv("backend/.env")

# Add backend directory to path
sys.path.append(os.path.abspath("backend"))

from app.services.measure_service import MeasureService
from app.core.database import SessionLocal

def test():
    print("Reading test image...")
    image_path = "docs/raw/login/screen.png"
    if not os.path.exists(image_path):
        print(f"Error: {image_path} does not exist.")
        return
        
    with open(image_path, "rb") as f:
        file_content = f.read()
        
    db = SessionLocal()
    try:
        print("Running MeasureService.predict...")
        result = MeasureService.predict(
            db=db,
            user_id="test-user-id",
            file_content=file_content,
            filename="screen.png",
            age=45,
            sex="F",
            bmi=21.5
        )
        print("Result returned successfully!")
        print(f"Measurement ID: {result.get('measurement_id')}")
        print(f"Predicted Label: {result.get('predicted_label')}")
        print(f"T-score: {result.get('predicted_t_score')}")
        # Print heatmap url directly as ascii
        print(f"Heatmap URL type: {type(result.get('heatmap_url'))}")
        print(f"Heatmap URL: {str(result.get('heatmap_url'))}")
    except Exception as e:
        print("EXCEPTION RAISED:", e)
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()

import sys
import os
from dotenv import load_dotenv

# Load env
load_dotenv("backend/.env")
sys.path.append(os.path.abspath("backend"))

from sqlalchemy import inspect
from app.core.database import engine

def check():
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('measurement_results')]
    print("Columns in measurement_results:")
    print(columns)
    if 'image_heatmap_r2_key' in columns:
        print("image_heatmap_r2_key column exists!")
    else:
        print("image_heatmap_r2_key column DOES NOT exist.")

if __name__ == "__main__":
    check()

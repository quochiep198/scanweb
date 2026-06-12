import sys
import os
from dotenv import load_dotenv

# Load env
load_dotenv("backend/.env")
sys.path.append(os.path.abspath("backend"))

from app.core.database import SessionLocal
from app.models.training_history import TrainingHistory

def reset():
    db = SessionLocal()
    try:
        active_runs = db.query(TrainingHistory).filter(TrainingHistory.status == "running").all()
        if active_runs:
            print(f"Found {len(active_runs)} active/locked training runs in database:")
            for r in active_runs:
                print(f"ID: {r.id} | Run Name: {r.run_name} | Created At: {r.created_at}")
                # Reset status to failed
                r.status = "failed"
                print(f"Updated status of run {r.id} to 'failed'.")
            db.commit()
            print("Successfully committed changes to database. The training lock has been cleared!")
        else:
            print("No active/locked training runs found in database.")
    except Exception as e:
        db.rollback()
        print("EXCEPTION OCCURRED:", e)
    finally:
        db.close()

if __name__ == "__main__":
    reset()

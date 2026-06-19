import os
import sys
from sqlalchemy import create_engine, text

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

db_url = "postgresql://neondb_owner:npg_INR0BvrEy2zV@ep-red-frost-aqassdi4-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
engine = create_engine(db_url)

def main():
    run_id = None
    if len(sys.argv) > 1:
        run_id = sys.argv[1]
        
    with engine.connect() as conn:
        if not run_id:
            latest = conn.execute(text("SELECT id, run_name FROM training_history ORDER BY created_at DESC LIMIT 1")).fetchone()
            if latest:
                run_id = latest[0]
                print(f"Latest run ID: {run_id} (Name: {latest[1]})")
            else:
                print("No runs found in training_history.")
                return
        else:
            print(f"Fetching logs for run {run_id}...")

        # Check history status
        hist = conn.execute(text("SELECT status, error_message FROM training_history WHERE id = :id"), {"id": run_id}).fetchone()
        if hist:
            print(f"Status: {hist[0]}")
            if hist[1]:
                print(f"Error Message:\n{hist[1]}")
        else:
            print("Run not found in training_history.")
            return

        # Fetch logs
        logs = conn.execute(text("SELECT message, created_at FROM training_logs WHERE run_id = :id ORDER BY created_at ASC, id ASC"), {"id": run_id}).fetchall()
        print("Logs:")
        for log in logs:
            print(f"  [{log[1]}] {log[0]}", flush=True)

if __name__ == "__main__":
    main()

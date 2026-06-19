import os
import sys
from sqlalchemy import create_engine, text

# Force stdout to UTF-8 to prevent encoding errors in Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to path if needed
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

db_url = "postgresql://neondb_owner:npg_INR0BvrEy2zV@ep-red-frost-aqassdi4-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
engine = create_engine(db_url)

def get_latest_runs():
    with engine.connect() as conn:
        # Get last 5 training history entries
        query = text("""
            SELECT id, run_name, status, error_message, created_at, completed_at 
            FROM training_history 
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        result = conn.execute(query).fetchall()
        for row in result:
            print(f"ID: {row[0]} | Name: {row[1]} | Status: {row[2]} | Created: {row[4]}")
            if row[3]:
                print(f"  Error: {row[3]}")
            
            # Print logs for this run
            log_query = text("""
                SELECT message, created_at 
                FROM training_logs 
                WHERE run_id = :run_id 
                ORDER BY created_at ASC
            """)
            logs = conn.execute(log_query, {"run_id": row[0]}).fetchall()
            print("  Logs:")
            for log in logs:
                print(f"    [{log[1]}] {log[0]}")
            print("-" * 80)

if __name__ == "__main__":
    get_latest_runs()

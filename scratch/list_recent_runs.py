import os
import sys
from sqlalchemy import create_engine, text

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

db_url = "postgresql://neondb_owner:npg_INR0BvrEy2zV@ep-red-frost-aqassdi4-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
engine = create_engine(db_url)

def main():
    print("Listing last 10 training history runs...", flush=True)
    with engine.connect() as conn:
        query = text("""
            SELECT id, run_name, status, error_message, created_at 
            FROM training_history 
            ORDER BY created_at DESC 
            LIMIT 10
        """)
        result = conn.execute(query).fetchall()
        for idx, row in enumerate(result):
            print(f"{idx+1}. ID: {row[0]} | Name: {row[1]} | Status: {row[2]} | Created: {row[4]}", flush=True)
            if row[3]:
                print(f"   Error:\n{row[3]}", flush=True)

if __name__ == "__main__":
    main()

import os
import sys
from sqlalchemy import create_engine, text

db_url = "postgresql://neondb_owner:npg_INR0BvrEy2zV@ep-red-frost-aqassdi4-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
engine = create_engine(db_url)

def main():
    print("Resetting sequence for training_logs table...")
    with engine.begin() as conn:
        # Check max ID
        max_id = conn.execute(text("SELECT MAX(id) FROM training_logs")).scalar()
        print(f"Current Max ID in training_logs: {max_id}")
        
        # Reset sequence
        if max_id is not None:
            conn.execute(text(f"SELECT setval('training_logs_id_seq', {max_id})"))
            print("Successfully reset sequence training_logs_id_seq.")
        else:
            print("Table is empty, no reset needed.")

if __name__ == "__main__":
    main()

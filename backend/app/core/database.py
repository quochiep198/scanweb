from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Tự động kiểm tra và kết nối lại nếu kết nối bị đứt
    pool_recycle=1800,   # Tái tạo kết nối sau mỗi 30 phút để tránh timeout của Vercel/Neon
    pool_size=5,
    max_overflow=10
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def check_and_update_schema():
    try:
        inspector = inspect(engine)
        if 'xray_images' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('xray_images')]
            if 'is_trained' not in columns:
                logger.info("Adding 'is_trained' column to 'xray_images' table...")
                with engine.begin() as conn:
                    if engine.dialect.name == 'sqlite':
                        conn.execute(text("ALTER TABLE xray_images ADD COLUMN is_trained BOOLEAN NOT NULL DEFAULT 0"))
                    else:
                        conn.execute(text("ALTER TABLE xray_images ADD COLUMN is_trained BOOLEAN NOT NULL DEFAULT FALSE"))
                logger.info("'is_trained' column added successfully.")
            if 'created_at' not in columns:
                logger.info("Adding 'created_at' column to 'xray_images' table...")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE xray_images ADD COLUMN created_at DATE NOT NULL DEFAULT CURRENT_DATE"))
                logger.info("'created_at' column added successfully.")
            if 'trained_date' not in columns:
                logger.info("Adding 'trained_date' column to 'xray_images' table...")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE xray_images ADD COLUMN trained_date DATE NULL"))
                logger.info("'trained_date' column added successfully.")

        if 'measurement_results' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('measurement_results')]
            new_columns = {
                'image_r2_key': 'VARCHAR(500) NULL',
                'image_sha256_hash': 'VARCHAR(64) NULL',
                'doctor_confirmed_label': 'VARCHAR(50) NULL',
                'is_ai_correct': 'BOOLEAN NULL',
                'review_status': "VARCHAR(50) NULL DEFAULT 'pending'",
                'error_type': "VARCHAR(50) NULL DEFAULT 'none'",
                'approved_for_next_training': 'BOOLEAN NULL DEFAULT FALSE',
                'review_note': 'TEXT NULL',
                'reviewed_by': 'VARCHAR(36) NULL',
                'reviewed_at': 'TIMESTAMP NULL' if engine.dialect.name != 'sqlite' else 'DATETIME NULL',
                'model_version': 'VARCHAR(100) NULL',
                'dataset_version': 'VARCHAR(100) NULL'
            }
            for col_name, col_type in new_columns.items():
                if col_name not in columns:
                    logger.info(f"Adding '{col_name}' column to 'measurement_results' table...")
                    with engine.begin() as conn:
                        sql_type = col_type
                        if engine.dialect.name == 'sqlite':
                            if 'DEFAULT FALSE' in col_type:
                                sql_type = col_type.replace('DEFAULT FALSE', 'DEFAULT 0')
                        conn.execute(text(f"ALTER TABLE measurement_results ADD COLUMN {col_name} {sql_type}"))
                    logger.info(f"'{col_name}' column added successfully.")
    except Exception as e:
        logger.error(f"Error checking/updating schema: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
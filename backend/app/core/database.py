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
    except Exception as e:
        logger.error(f"Error checking/updating schema: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
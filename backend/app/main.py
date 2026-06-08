import os
os.environ["GIT_PYTHON_REFRESH"] = "quiet"

from fastapi import FastAPI, Depends
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import logging

from app.core.config import settings
from app.core.database import engine, get_db, Base, check_and_update_schema
from app.routers.auth import router as auth_router
from app.models import User
from app.dependencies.auth import get_current_user

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    force=True,
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="OsteoAI API",
    description="Medical Imaging Data Collection Platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.BACKEND_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
Base.metadata.create_all(bind=engine)
check_and_update_schema()

# Seed database
from app.core.seeding import seed_data
seed_data()

# Include routers
from app.routers.upload import router as upload_router
from app.routers.training import router as training_router
from app.routers.dashboard import router as dashboard_router
from app.routers.measure import router as measure_router
app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(training_router)
app.include_router(dashboard_router)
app.include_router(measure_router)

logger.info("Backend logging initialized")
logger.info("CORS origins: %s", settings.cors_origins)
logger.info("R2 Config - ACCOUNT_ID present: %s", bool(settings.CLOUDFLARE_R2_ACCOUNT_ID))
logger.info("R2 Config - ACCESS_KEY_ID present: %s", bool(settings.CLOUDFLARE_R2_ACCESS_KEY_ID))
logger.info("R2 Config - SECRET_ACCESS_KEY present: %s", bool(settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY))
logger.info("R2 Config - BUCKET_NAME present: %s", bool(settings.CLOUDFLARE_R2_BUCKET_NAME))
logger.info("R2 Config - PUBLIC_URL present: %s", bool(settings.CLOUDFLARE_R2_PUBLIC_URL))

@app.on_event("startup")
async def startup_event():
    import asyncio
    import threading
    from datetime import datetime, timedelta
    from app.services.training_service import TrainingService
    from app.core.database import SessionLocal

    def run_nightly_full_retrain():
        try:
            logger.info("Scheduler: Starting scheduled weekly full retraining...")
            with SessionLocal() as db:
                import uuid
                from app.models.training_history import TrainingHistory
                history_id = str(uuid.uuid4())
                training_history_record = TrainingHistory(
                    id=history_id,
                    run_name=f"Scheduled Full Retrain {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                    trainer_id="system_scheduler",
                    status="running",
                    clinical_info="Tác vụ tự động huấn luyện lại toàn bộ mô hình hàng tuần (Weekly Scheduler)",
                    dataset_size=0
                )
                db.add(training_history_record)
                db.commit()

                TrainingService.run_training_pipeline(
                    db=db,
                    trainer_id="system_scheduler",
                    history_id=history_id,
                    use_augmentation=True,
                    force_full=True
                )
        except Exception as e:
            logger.error(f"Scheduler: Scheduled weekly retraining failed: {e}")

    async def nightly_training_scheduler():
        logger.info("Scheduler: Nightly training scheduler started.")
        while True:
            now = datetime.now()
            # Calculate time until next Sunday at 2:00 AM
            days_until_sunday = (6 - now.weekday()) % 7
            next_run = datetime.combine(
                now.date() + timedelta(days=days_until_sunday),
                datetime.strptime("02:00:00", "%H:%M:%S").time()
            )
            
            # If it is already Sunday past 2 AM, schedule for next Sunday
            if next_run <= now:
                next_run += timedelta(days=7)
                
            sleep_seconds = (next_run - now).total_seconds()
            logger.info(f"Scheduler: Weekly full retraining scheduled for {next_run} (in {sleep_seconds:.1f} seconds)")
            
            await asyncio.sleep(sleep_seconds)
            
            # Run in a separate thread to prevent blocking the async event loop
            thread = threading.Thread(target=run_nightly_full_retrain)
            thread.start()
            
            # Sleep to avoid double trigger
            await asyncio.sleep(60)

    asyncio.create_task(nightly_training_scheduler())

@app.get("/", include_in_schema=False)
def read_root():
    return RedirectResponse(url="/docs")

@app.get('/health')
def health():
    return {'status': 'ok'}

@app.get("/v1/protected")
def protected_route(
    current_user: User = Depends(get_current_user),
):
    return {
        "message": "Access granted",
        "user_id": current_user.id,
        "email": current_user.email,
        "name": current_user.name
    }

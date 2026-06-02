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

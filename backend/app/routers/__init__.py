from app.routers.auth import router as auth_router
from app.routers.upload import router as upload_router
from app.routers.training import router as training_router
from app.routers.dashboard import router as dashboard_router

__all__ = ["auth_router", "upload_router", "training_router", "dashboard_router"]

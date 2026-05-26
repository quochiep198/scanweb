from app.core.database import Base
from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.login_attempt import LoginAttempt
from app.models.scan_zone import ScanZone
from app.models.diagnostic_label import DiagnosticLabel
from app.models.patient import Patient
from app.models.xray_image import XRayImage
from app.models.osteoporosis_label import OsteoporosisLabel

__all__ = [
    "Base",
    "User",
    "OTP",
    "RefreshToken",
    "LoginAttempt",
    "ScanZone",
    "DiagnosticLabel",
    "Patient",
    "XRayImage",
    "OsteoporosisLabel",
]
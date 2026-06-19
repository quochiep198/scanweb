from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str

    # JWT Settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OTP Settings
    OTP_EXPIRE_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 3
    OTP_RATE_LIMIT_SECONDS: int = 60

    # Security
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    # Email (Resend)
    RESEND_API_KEY: str
    EMAIL_FROM: str
    FRONTEND_URL: str
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"
    BACKEND_CORS_ORIGIN_REGEX: str = (
        r"^(https://.*\.vercel\.app|https://.*\.thtsolution\.online|"
        r"https?://(?:localhost|127\.0\.0\.1|"
        r"192\.168(?:\.\d{1,3}){2}|"
        r"10(?:\.\d{1,3}){3}|"
        r"172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})"
        r"(?::\d+)?)$"
    )

    # Cloudflare R2 Settings
    CLOUDFLARE_R2_ACCOUNT_ID: str = ""
    CLOUDFLARE_R2_ACCESS_KEY_ID: str = ""
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: str = ""
    CLOUDFLARE_R2_BUCKET_NAME: str = ""
    CLOUDFLARE_R2_PUBLIC_URL: str = ""

    # Model & Dataset version control
    ACTIVE_MODEL_VERSION: str = "v1.0.0"
    ACTIVE_DATASET_VERSION: str = "dataset_v1.0"
    GOOGLE_CLIENT_ID: str = ""
    
    # Kaggle Settings
    KAGGLE_USERNAME: str = ""
    KAGGLE_KEY: str = ""


    AUTH_COOKIE_DOMAIN: str = ""
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: str = "lax"

    @property
    def cors_origins(self) -> list[str]:
        origins = {
            origin.strip().rstrip("/")
            for origin in self.BACKEND_CORS_ORIGINS.split(",")
            if origin.strip()
        }

        if self.FRONTEND_URL.strip():
            origins.add(self.FRONTEND_URL.strip().rstrip("/"))

        return sorted(origins)

    @property
    def auth_cookie_secure(self) -> bool:
        return self.AUTH_COOKIE_SECURE or self.FRONTEND_URL.startswith("https://")

    class Config:
        env_file = ".env"

settings = Settings()

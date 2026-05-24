from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://neondb_owner:npg_INR0BvrEy2zV@ep-red-frost-aqassdi4-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"

    # JWT Settings
    SECRET_KEY: str = "your-secret-key-change-in-production"
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
    RESEND_API_KEY: str = "re_gbgmFeQc_2WGJh5NLWULhRZJBuw3eJBF3"
    EMAIL_FROM: str = "OsteoAI <noreply@python.thtsolution.online>"

    class Config:
        env_file = ".env"

settings = Settings()
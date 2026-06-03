from sqlalchemy import Column, String, DateTime
from app.core.database import Base
from datetime import datetime

class BlacklistedToken(Base):
    __tablename__ = "blacklisted_tokens"

    token = Column(String(500), primary_key=True, index=True)
    blacklisted_at = Column(DateTime, default=datetime.utcnow)

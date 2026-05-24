from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": expire
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": user_id,
        "type": "refresh",
        "exp": expire
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

def create_verification_token(user_id: str, email: str) -> str:
    """Create email verification token"""
    expire = datetime.utcnow() + timedelta(hours=24)  # Valid for 24 hours
    to_encode = {
        "sub": user_id,
        "email": email,
        "type": "verification",
        "exp": expire
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def generate_otp() -> str:
    import random
    return str(random.randint(100000, 999999))

def validate_password(password: str) -> tuple[bool, str]:
    """
    BR-7: Password phải >= 8 ký tự, có ít nhất 1 chữ hoa, 1 chữ thường, 1 số.
    Returns: (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Mật khẩu phải có ít nhất 8 ký tự"
    if not any(c.isupper() for c in password):
        return False, "Mật khẩu phải có ít nhất 1 chữ hoa"
    if not any(c.islower() for c in password):
        return False, "Mật khẩu phải có ít nhất 1 chữ thường"
    if not any(c.isdigit() for c in password):
        return False, "Mật khẩu phải có ít nhất 1 số"
    return True, ""

def validate_email(email: str) -> bool:
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))
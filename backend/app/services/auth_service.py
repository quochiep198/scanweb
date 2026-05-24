from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
import uuid

from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.login_attempt import LoginAttempt
from app.core.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, generate_otp
)
from app.core.config import settings

class AuthService:

    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def create_user(db: Session, name: str, email: str, password: str) -> User:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            name=name,
            password_hash=hash_password(password),
            is_verified=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> tuple[Optional[User], str]:
        """
        Returns: (user, error_message)
        """
        user = AuthService.get_user_by_email(db, email)

        if not user:
            return None, "Tài khoản không tồn tại"

        if not user.is_active:
            return None, "Tài khoản đã bị vô hiệu hóa"

        if user.is_locked and user.locked_until and user.locked_until > datetime.utcnow():
            remaining = int((user.locked_until - datetime.utcnow()).total_seconds() / 60)
            return None, f"Tài khoản bị khóa. Vui lòng thử lại sau {remaining} phút"

        if not verify_password(password, user.password_hash):
            AuthService._handle_failed_login(db, user)
            return None, "Email hoặc mật khẩu không đúng"

        # Success - reset failed attempts
        user.failed_login_attempts = 0
        user.is_locked = False
        user.locked_until = None
        db.commit()
        return user, ""

    @staticmethod
    def _handle_failed_login(db: Session, user: User):
        user.failed_login_attempts += 1

        if user.failed_login_attempts >= settings.LOGIN_MAX_ATTEMPTS:
            user.is_locked = True
            user.locked_until = datetime.utcnow() + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
            db.commit()
            raise ValueError(f"Đăng nhập thất bại 5 lần. Tài khoản bị khóa trong {settings.LOGIN_LOCKOUT_MINUTES} phút")

        db.commit()

    @staticmethod
    def create_tokens(user: User) -> tuple[str, str]:
        access_token = create_access_token(user.id, user.email)
        refresh_token = create_refresh_token(user.id)
        return access_token, refresh_token

    @staticmethod
    def create_refresh_token_record(db: Session, user_id: str, token: str) -> RefreshToken:
        expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        refresh_token = RefreshToken(
            id=str(uuid.uuid4()),
            user_id=user_id,
            token=token,
            expires_at=expires_at
        )
        db.add(refresh_token)
        db.commit()
        return refresh_token

    @staticmethod
    def verify_refresh_token(db: Session, token: str) -> tuple[Optional[RefreshToken], str]:
        """
        Returns: (refresh_token_record, error_message)
        """
        token_record = db.query(RefreshToken).filter(
            and_(
                RefreshToken.token == token,
                RefreshToken.is_revoked == False
            )
        ).first()

        if not token_record:
            return None, "Invalid refresh token"

        if token_record.expires_at < datetime.utcnow():
            return None, "Refresh token expired"

        return token_record, ""

    @staticmethod
    def revoke_refresh_token(db: Session, token: str):
        token_record = db.query(RefreshToken).filter(RefreshToken.token == token).first()
        if token_record:
            token_record.is_revoked = True
            db.commit()

    @staticmethod
    def create_otp(db: Session, email: str, user_id: Optional[str] = None) -> OTP:
        # Delete existing OTPs for this email
        db.query(OTP).filter(OTP.email == email).delete()
        db.commit()

        otp = OTP(
            id=str(uuid.uuid4()),
            user_id=user_id,
            email=email,
            code=generate_otp(),
            expires_at=datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
        )
        db.add(otp)
        db.commit()
        return otp

    @staticmethod
    def verify_otp(db: Session, email: str, otp_code: str) -> tuple[bool, str]:
        """
        Returns: (success, error_message)
        """
        otp_record = db.query(OTP).filter(
            and_(
                OTP.email == email,
                OTP.code == otp_code
            )
        ).order_by(OTP.created_at.desc()).first()

        if not otp_record:
            return False, "Mã OTP không hợp lệ"

        if otp_record.attempts >= settings.OTP_MAX_ATTEMPTS:
            return False, f"Bạn đã nhập sai {settings.OTP_MAX_ATTEMPTS} lần. Vui lòng yêu cầu mã mới"

        if otp_record.expires_at < datetime.utcnow():
            return False, "Mã OTP đã hết hạn"

        return True, ""

    @staticmethod
    def increment_otp_attempts(db: Session, email: str):
        otp_record = db.query(OTP).filter(
            and_(
                OTP.email == email
            )
        ).order_by(OTP.created_at.desc()).first()

        if otp_record:
            otp_record.attempts += 1
            db.commit()

    @staticmethod
    def delete_otp(db: Session, email: str):
        db.query(OTP).filter(OTP.email == email).delete()
        db.commit()

    @staticmethod
    def update_password(db: Session, user: User, new_password: str):
        user.password_hash = hash_password(new_password)
        # Revoke all refresh tokens for this user
        db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"is_revoked": True})
        AuthService.delete_otp(db, user.email)
        db.commit()

    @staticmethod
    def can_request_otp(db: Session, email: str) -> tuple[bool, str]:
        """
        Check rate limit for OTP requests
        Returns: (can_request, error_message)
        """
        latest_otp = db.query(OTP).filter(
            OTP.email == email
        ).order_by(OTP.created_at.desc()).first()

        if latest_otp:
            elapsed = datetime.utcnow() - latest_otp.created_at
            if elapsed.total_seconds() < settings.OTP_RATE_LIMIT_SECONDS:
                remaining = settings.OTP_RATE_LIMIT_SECONDS - int(elapsed.total_seconds())
                return False, f"Vui lòng đợi {remaining} giây trước khi yêu cầu mã mới"

        return True, ""
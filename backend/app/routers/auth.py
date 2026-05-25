from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from app.core.database import get_db
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    TokenResponse,
    MessageResponse,
)
from app.services.auth_service import AuthService
from app.services.email_service import send_otp_email, send_verification_email
from app.core.security import create_verification_token, decode_token

router = APIRouter(prefix="/v1/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user."""
    existing_user = AuthService.get_user_by_email(db, request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email da duoc dang ky",
        )

    user = AuthService.create_user(db, request.name, request.email, request.password)

    logger.info("New user registered: %s", request.email)

    verification_token = create_verification_token(user.id, user.email)
    email_sent = send_verification_email(request.email, request.name, verification_token)

    if not email_sent:
        logger.error("User registered but verification email could not be sent: %s", request.email)
        return MessageResponse(
            message=(
                "Dang ky thanh cong nhung khong gui duoc email xac thuc. "
                "Vui long kiem tra cau hinh email va thu lai."
            ),
            user_id=user.id,
        )

    return MessageResponse(
        message="Dang ky thanh cong. Vui long kiem tra email de xac thuc.",
        user_id=user.id,
    )


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password."""
    try:
        user, error = AuthService.authenticate_user(db, request.email, request.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=str(e),
        )

    if error:
        logger.warning("Login failed for %s: %s", request.email, error)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error,
        )

    access_token, refresh_token = AuthService.create_tokens(user)
    AuthService.create_refresh_token_record(db, user.id, refresh_token)

    logger.info("User logged in: %s", request.email)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshRequest, db: Session = Depends(get_db)):
    """Refresh access token using refresh token."""
    token_record, error = AuthService.verify_refresh_token(db, request.refresh_token)

    if error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error,
        )

    user = AuthService.get_user_by_id(db, token_record.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    AuthService.revoke_refresh_token(db, request.refresh_token)

    access_token, new_refresh_token = AuthService.create_tokens(user)
    AuthService.create_refresh_token_record(db, user.id, new_refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request OTP for password reset."""
    can_request, error = AuthService.can_request_otp(db, request.email)
    if not can_request:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error,
        )

    user = AuthService.get_user_by_email(db, request.email)

    result = AuthService.create_otp(db, request.email, user.id if user else None)

    logger.info("OTP requested for: %s", request.email)

    send_otp_email(request.email, result.code)

    return MessageResponse(message="Da gui ma OTP den email cua ban")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using OTP."""
    success, error = AuthService.verify_otp(db, request.email, request.otp)

    if not success:
        AuthService.increment_otp_attempts(db, request.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error,
        )

    user = AuthService.get_user_by_email(db, request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tai khoan khong ton tai",
        )

    AuthService.update_password(db, user, request.new_password)

    logger.info("Password reset for: %s", request.email)

    return MessageResponse(message="Dat lai mat khau thanh cong")


@router.post("/logout", response_model=MessageResponse)
def logout(request: RefreshRequest, db: Session = Depends(get_db)):
    """Logout and revoke refresh token."""
    AuthService.revoke_refresh_token(db, request.refresh_token)
    return MessageResponse(message="Dang xuat thanh cong")


@router.get("/verify-email", response_model=MessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    """Verify email with token from verification email."""
    payload = decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token khong hop le hoac da het han",
        )

    if payload.get("type") != "verification":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token khong dung loai",
        )

    user_id = payload.get("sub")

    user = AuthService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tai khoan khong ton tai",
        )

    if user.is_verified:
        return MessageResponse(message="Email da duoc xac thuc truoc do")

    user.is_verified = True
    db.commit()

    logger.info("Email verified for: %s", user.email)

    return MessageResponse(
        message="Xac thuc email thanh cong. Ban co the dang nhap ngay.",
    )

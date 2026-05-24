from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import EmailStr
import logging

from app.core.database import get_db
from app.schemas.auth import (
    RegisterRequest, LoginRequest, RefreshRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
    TokenResponse, MessageResponse
)
from app.services.auth_service import AuthService
from app.services.email_service import send_otp_email, send_verification_email
from app.core.security import create_verification_token, decode_token

router = APIRouter(prefix="/v1/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user"""
    existing_user = AuthService.get_user_by_email(db, request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email đã được đăng ký"
        )

    user = AuthService.create_user(db, request.name, request.email, request.password)

    logger.info(f"New user registered: {request.email}")

    # Create verification token and send email
    verification_token = create_verification_token(user.id, user.email)
    send_verification_email(request.email, request.name, verification_token)

    return MessageResponse(
        message="Đăng ký thành công. Vui lòng kiểm tra email để xác thực.",
        user_id=user.id
    )

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password"""
    try:
        user, error = AuthService.authenticate_user(db, request.email, request.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=str(e)
        )

    if error:
        logger.warning(f"Login failed for {request.email}: {error}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error
        )

    access_token, refresh_token = AuthService.create_tokens(user)
    AuthService.create_refresh_token_record(db, user.id, refresh_token)

    logger.info(f"User logged in: {request.email}")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshRequest, db: Session = Depends(get_db)):
    """Refresh access token using refresh token"""
    token_record, error = AuthService.verify_refresh_token(db, request.refresh_token)

    if error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error
        )

    user = AuthService.get_user_by_id(db, token_record.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # Revoke old refresh token (rotate)
    AuthService.revoke_refresh_token(db, request.refresh_token)

    # Create new tokens
    access_token, new_refresh_token = AuthService.create_tokens(user)
    AuthService.create_refresh_token_record(db, user.id, new_refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token
    )

@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request OTP for password reset"""
    can_request, error = AuthService.can_request_otp(db, request.email)
    if not can_request:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error
        )

    user = AuthService.get_user_by_email(db, request.email)

    # Always return success to prevent email enumeration
    result = AuthService.create_otp(db, request.email, user.id if user else None)

    logger.info(f"OTP requested for: {request.email}")

    # Send OTP email
    send_otp_email(request.email, result.code)

    return MessageResponse(message="Đã gửi mã OTP đến email của bạn")

@router.post("/reset-password", response_model=MessageResponse)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using OTP"""
    success, error = AuthService.verify_otp(db, request.email, request.otp)

    if not success:
        AuthService.increment_otp_attempts(db, request.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )

    user = AuthService.get_user_by_email(db, request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài khoản không tồn tại"
        )

    AuthService.update_password(db, user, request.new_password)

    logger.info(f"Password reset for: {request.email}")

    return MessageResponse(message="Đặt lại mật khẩu thành công")

@router.post("/logout", response_model=MessageResponse)
def logout(request: RefreshRequest, db: Session = Depends(get_db)):
    """Logout - revoke refresh token"""
    AuthService.revoke_refresh_token(db, request.refresh_token)
    return MessageResponse(message="Đăng xuất thành công")

@router.get("/verify-email", response_model=MessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    """Verify email with token from verification email"""
    payload = decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token không hợp lệ hoặc đã hết hạn"
        )

    if payload.get("type") != "verification":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token không đúng loại"
        )

    user_id = payload.get("sub")
    email = payload.get("email")

    user = AuthService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tài khoản không tồn tại"
        )

    if user.is_verified:
        return MessageResponse(message="Email đã được xác thực trước đó")

    user.is_verified = True
    db.commit()

    logger.info(f"Email verified for: {user.email}")

    return MessageResponse(
        message="Xác thực email thành công! Bạn có thể đăng nhập ngay."
    )
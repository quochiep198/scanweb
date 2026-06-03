from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
import logging

from app.core.auth_cookies import (
    clear_auth_cookies,
    get_refresh_token_from_request,
    set_auth_cookies,
)
from app.core.database import get_db
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse,
    UserResponse,
)
from app.services.auth_service import AuthService
from app.services.email_service import send_otp_email, send_verification_email
from app.core.security import create_verification_token, decode_token

router = APIRouter(prefix="/v1/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user."""
    logger.info("Register request received for %s", request.email)
    existing_user = AuthService.get_user_by_email(db, request.email)
    if existing_user:
        logger.warning("Register skipped because email already exists: %s", request.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email da duoc dang ky",
        )

    user = AuthService.create_user(db, request.name, request.email, request.password)

    logger.info("New user registered: %s", request.email)

    verification_token = create_verification_token(user.id, user.email)
    logger.info("Attempting to send verification email to %s", request.email)
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


@router.post("/login", response_model=MessageResponse)
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)):
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
    set_auth_cookies(response, access_token, refresh_token)

    logger.info("User logged in: %s", request.email)

    return MessageResponse(message="Dang nhap thanh cong", user_id=user.id)


@router.post("/refresh", response_model=MessageResponse)
def refresh_token(response: Response, req: Request, db: Session = Depends(get_db)):
    """Refresh access token using refresh token."""
    refresh_token = get_refresh_token_from_request(req)
    if not refresh_token:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    token_record, error = AuthService.verify_refresh_token(db, refresh_token)

    if error:
        clear_auth_cookies(response)
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

    AuthService.revoke_refresh_token(db, refresh_token)

    access_token, new_refresh_token = AuthService.create_tokens(user)
    AuthService.create_refresh_token_record(db, user.id, new_refresh_token)
    set_auth_cookies(response, access_token, new_refresh_token)

    return MessageResponse(message="Lam moi phien thanh cong", user_id=user.id)


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request OTP for password reset."""
    logger.info("Forgot password request received for %s", request.email)
    can_request, error = AuthService.can_request_otp(db, request.email)
    if not can_request:
        logger.warning("Forgot password rate limited for %s: %s", request.email, error)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error,
        )

    user = AuthService.get_user_by_email(db, request.email)

    result = AuthService.create_otp(db, request.email, user.id if user else None)

    logger.info("OTP requested for: %s", request.email)

    logger.info("Attempting to send OTP email to %s", request.email)
    email_sent = send_otp_email(request.email, result.code)

    if not email_sent:
        logger.error("OTP email could not be sent to %s", request.email)
        return MessageResponse(message="Khong gui duoc ma OTP. Vui long thu lai sau.")

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
def logout(response: Response, req: Request, db: Session = Depends(get_db)):
    """Logout and revoke refresh token and blacklist access token."""
    from app.core.auth_cookies import get_access_token_from_request
    access_token = get_access_token_from_request(req)
    if access_token:
        AuthService.blacklist_access_token(db, access_token)

    refresh_token = get_refresh_token_from_request(req)
    if refresh_token:
        AuthService.revoke_refresh_token(db, refresh_token)
    clear_auth_cookies(response)
    return MessageResponse(message="Dang xuat thanh cong")


@router.get("/me", response_model=UserResponse)
def me(req: Request, db: Session = Depends(get_db)):
    access_token = req.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    payload = decode_token(access_token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = AuthService.get_user_by_id(db, payload.get("sub"))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse.model_validate(user)


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

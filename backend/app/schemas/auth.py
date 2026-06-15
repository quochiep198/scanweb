from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Họ tên phải có ít nhất 2 ký tự')
        return v.strip()

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Mật khẩu phải có ít nhất 8 ký tự')
        if not any(c.isupper() for c in v):
            raise ValueError('Mật khẩu phải có ít nhất 1 chữ hoa')
        if not any(c.islower() for c in v):
            raise ValueError('Mật khẩu phải có ít nhất 1 chữ thường')
        if not any(c.isdigit() for c in v):
            raise ValueError('Mật khẩu phải có ít nhất 1 số')
        return v

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

    @field_validator('otp')
    @classmethod
    def validate_otp(cls, v):
        if not v.isdigit() or len(v) != 6:
            raise ValueError('OTP phải là 6 chữ số')
        return v

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Mật khẩu phải có ít nhất 8 ký tự')
        if not any(c.isupper() for c in v):
            raise ValueError('Mật khẩu phải có ít nhất 1 chữ hoa')
        if not any(c.islower() for c in v):
            raise ValueError('Mật khẩu phải có ít nhất 1 chữ thường')
        if not any(c.isdigit() for c in v):
            raise ValueError('Mật khẩu phải có ít nhất 1 số')
        return v

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"

class MessageResponse(BaseModel):
    message: str
    user_id: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    is_verified: bool

    class Config:
        from_attributes = True

class GoogleLoginRequest(BaseModel):
    credential: str
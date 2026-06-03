from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.auth_cookies import get_access_token_from_request
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    token = get_access_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    from app.services.auth_service import AuthService
    if AuthService.is_token_blacklisted(db, token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been blacklisted"
        )

    payload = decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )

    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user

from fastapi import Request, Response

from app.core.config import settings

ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"


def _cookie_kwargs(max_age: int | None) -> dict:
    kwargs = {
        "httponly": True,
        "secure": settings.auth_cookie_secure,
        "samesite":  "lax" if settings.AUTH_COOKIE_SAMESITE.lower() == "lax" else "strict",
        "path": "/",
    }
    if max_age is not None:
        kwargs["max_age"] = max_age

    if settings.AUTH_COOKIE_DOMAIN.strip():
      kwargs["domain"] = settings.AUTH_COOKIE_DOMAIN.strip()

    return kwargs


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    remember: bool = False
) -> None:
    access_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60 if remember else None
    refresh_max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 if remember else None

    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        **_cookie_kwargs(access_max_age),
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        **_cookie_kwargs(refresh_max_age),
    )


def clear_auth_cookies(response: Response) -> None:
    delete_kwargs = {
        "path": "/",
    }

    if settings.AUTH_COOKIE_DOMAIN.strip():
        delete_kwargs["domain"] = settings.AUTH_COOKIE_DOMAIN.strip()

    response.delete_cookie(ACCESS_COOKIE_NAME, **delete_kwargs)
    response.delete_cookie(REFRESH_COOKIE_NAME, **delete_kwargs)


def get_access_token_from_request(request: Request) -> str | None:
    return request.cookies.get(ACCESS_COOKIE_NAME)


def get_refresh_token_from_request(request: Request) -> str | None:
    return request.cookies.get(REFRESH_COOKIE_NAME)

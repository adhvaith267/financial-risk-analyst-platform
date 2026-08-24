from secrets import compare_digest
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from starlette.responses import RedirectResponse

from app.auth import (
    ACCESS_TOKEN_COOKIE,
    GOOGLE_STATE_COOKIE,
    authenticate_google,
    create_access_token,
    get_current_user,
    google_authorization_request,
    issue_token,
)
from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


@router.post("/token", response_model=TokenResponse)
def token(response: Response, form_data: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    token_response = TokenResponse(**issue_token(form_data))
    if response is not None:
        _set_access_cookie(response, token_response.access_token, token_response.expires_in)
    return token_response


@router.get("/google/start")
def google_start() -> RedirectResponse:
    authorization_url, state = google_authorization_request()
    settings = get_settings()
    response = RedirectResponse(authorization_url, status_code=307)
    response.set_cookie(
        GOOGLE_STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        path="/",
    )
    return response


@router.get("/google/callback")
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    settings = get_settings()
    state_cookie = request.cookies.get(GOOGLE_STATE_COOKIE)
    if (
        error
        or not code
        or not state
        or not state_cookie
        or not compare_digest(state, state_cookie)
    ):
        return _google_error_response(settings)

    try:
        user = authenticate_google(code, state)
        access_token = create_access_token(
            user.username, user.role, settings.auth_token_expire_minutes
        )
    except Exception:
        # Do not reflect provider errors or identity details into the browser.
        return _google_error_response(settings)

    response = RedirectResponse(settings.google_frontend_redirect_uri, status_code=303)
    _set_access_cookie(response, access_token, settings.auth_token_expire_minutes * 60)
    response.delete_cookie(GOOGLE_STATE_COOKIE)
    return response


class CurrentUserResponse(BaseModel):
    username: str
    role: str


@router.get("/me", response_model=CurrentUserResponse)
def current_user(user=Depends(get_current_user)) -> CurrentUserResponse:
    return CurrentUserResponse(username=user.username, role=user.role)


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(ACCESS_TOKEN_COOKIE)


def _set_access_cookie(response: Response, access_token: str, max_age: int) -> None:
    settings = get_settings()
    response.set_cookie(
        ACCESS_TOKEN_COOKIE,
        access_token,
        max_age=max_age,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        path="/",
    )


def _frontend_error(frontend_url: str) -> str:
    separator = "&" if "?" in frontend_url else "?"
    return f"{frontend_url}{separator}{urlencode({'auth_error': 'google_signin_failed'})}"


def _google_error_response(settings) -> RedirectResponse:
    response = RedirectResponse(_frontend_error(settings.google_frontend_redirect_uri))
    response.delete_cookie(GOOGLE_STATE_COOKIE)
    return response

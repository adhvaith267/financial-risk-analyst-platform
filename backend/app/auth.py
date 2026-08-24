import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from secrets import compare_digest
from typing import Annotated
from urllib.parse import urlencode
from uuid import uuid4

import httpx
import jwt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jwt.algorithms import RSAAlgorithm
from pwdlib import PasswordHash
from starlette.requests import Request

from app.core.config import get_settings
from app.core.errors import (
    AuthenticationRequiredError,
    AuthorizationDeniedError,
    DependencyUnavailableError,
)

JWT_ALGORITHM = "HS256"
JWT_ISSUER = "riskora-api"
JWT_AUDIENCE = "riskora-api"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
ACCESS_TOKEN_COOKIE = "riskora_access_token"
GOOGLE_STATE_COOKIE = "riskora_google_state"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


@dataclass(frozen=True)
class AuthenticatedUser:
    username: str
    role: str


@lru_cache
def get_password_hasher() -> PasswordHash:
    return PasswordHash.recommended()


def create_password_hash(password: str) -> str:
    return get_password_hasher().hash(password)


def create_access_token(username: str, role: str, expires_minutes: int) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": username,
        "role": role,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, get_settings().auth_secret_key, algorithm=JWT_ALGORITHM)


def _create_google_state(nonce: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "nonce": nonce,
        "purpose": "google-oauth-state",
        "iss": JWT_ISSUER,
        "aud": "riskora-google-state",
        "iat": now,
        "exp": now + timedelta(minutes=10),
    }
    return jwt.encode(payload, get_settings().auth_secret_key, algorithm=JWT_ALGORITHM)


def google_authorization_request() -> tuple[str, str]:
    settings = get_settings()
    if not settings.google_auth_enabled:
        raise DependencyUnavailableError("Google sign-in is not enabled.")
    if not settings.google_client_id or not settings.google_client_secret:
        raise DependencyUnavailableError("Google sign-in is not configured.")

    nonce = uuid4().hex
    state = _create_google_state(nonce)
    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "nonce": nonce,
            "prompt": "select_account",
        }
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}", state


def _validate_google_state(state: str) -> str:
    try:
        payload = jwt.decode(
            state,
            get_settings().auth_secret_key,
            algorithms=[JWT_ALGORITHM],
            audience="riskora-google-state",
            issuer=JWT_ISSUER,
        )
    except jwt.InvalidTokenError as exc:
        raise AuthenticationRequiredError(
            "The Google sign-in session is invalid or expired."
        ) from exc
    if payload.get("purpose") != "google-oauth-state" or not isinstance(payload.get("nonce"), str):
        raise AuthenticationRequiredError("The Google sign-in session is invalid.")
    return payload["nonce"]


def _exchange_google_code(code: str) -> str:
    settings = get_settings()
    try:
        response = httpx.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        response.raise_for_status()
        token_response = response.json()
        id_token = token_response.get("id_token")
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise DependencyUnavailableError("Google sign-in is temporarily unavailable.") from exc
    if not isinstance(id_token, str):
        raise DependencyUnavailableError("Google did not return a valid identity token.")
    return id_token


def _verify_google_id_token(id_token: str, expected_nonce: str) -> dict:
    settings = get_settings()
    try:
        header = jwt.get_unverified_header(id_token)
        key_id = header["kid"]
        jwks_response = httpx.get(GOOGLE_JWKS_URL, timeout=10)
        jwks_response.raise_for_status()
        jwks = jwks_response.json()["keys"]
        jwk = next(key for key in jwks if key.get("kid") == key_id)
        signing_key = RSAAlgorithm.from_jwk(json.dumps(jwk))
        claims = jwt.decode(
            id_token,
            signing_key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
        )
    except (
        httpx.HTTPError,
        KeyError,
        StopIteration,
        TypeError,
        ValueError,
        jwt.InvalidTokenError,
    ) as exc:
        raise AuthenticationRequiredError("Google returned an invalid identity token.") from exc

    if claims.get("iss") not in GOOGLE_ISSUERS or claims.get("nonce") != expected_nonce:
        raise AuthenticationRequiredError("Google returned an invalid identity token.")
    if claims.get("email_verified") is not True or not isinstance(claims.get("email"), str):
        raise AuthorizationDeniedError("Your Google email is not verified.")
    return claims


def authenticate_google(code: str, state: str) -> AuthenticatedUser:
    nonce = _validate_google_state(state)
    claims = _verify_google_id_token(_exchange_google_code(code), nonce)
    settings = get_settings()
    email = claims["email"].lower()
    domain = email.rsplit("@", maxsplit=1)[-1]
    if (
        email not in settings.google_allowed_emails_list
        and domain not in settings.google_allowed_domains_list
    ):
        raise AuthorizationDeniedError("This Google account is not authorized for Riskora.")
    return AuthenticatedUser(username=email, role=settings.auth_role)


def authenticate(username: str, password: str) -> AuthenticatedUser:
    settings = get_settings()
    if not settings.auth_enabled:
        raise DependencyUnavailableError("Authentication is not configured for this service.")
    if not settings.auth_username or not settings.auth_password_hash:
        raise DependencyUnavailableError("Authentication credentials are not configured.")

    try:
        password_valid = get_password_hasher().verify(password, settings.auth_password_hash)
    except Exception:
        password_valid = False
    if not compare_digest(username, settings.auth_username) or not password_valid:
        raise AuthenticationRequiredError("Invalid username or password.")
    return AuthenticatedUser(username=settings.auth_username, role=settings.auth_role)


def get_current_user(
    request: Request,
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> AuthenticatedUser:
    settings = get_settings()
    if settings.app_env == "test":
        return AuthenticatedUser(username="test", role="admin")
    if not settings.auth_enabled:
        return AuthenticatedUser(username="anonymous", role="admin")
    token = token or request.cookies.get(ACCESS_TOKEN_COOKIE)
    if not token:
        raise AuthenticationRequiredError("Authentication is required.")

    try:
        payload = jwt.decode(
            token,
            settings.auth_secret_key,
            algorithms=[JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
        username = payload.get("sub")
        role = payload.get("role")
    except jwt.InvalidTokenError as exc:
        raise AuthenticationRequiredError("The access token is invalid or expired.") from exc

    if not isinstance(username, str) or not isinstance(role, str):
        raise AuthenticationRequiredError("The access token is invalid.")
    return AuthenticatedUser(username=username, role=role)


def require_roles(*roles: str):
    def dependency(
        user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    ) -> AuthenticatedUser:
        if user.role not in roles:
            raise AuthorizationDeniedError("Your account is not authorized for this operation.")
        return user

    return dependency


def issue_token(form_data: OAuth2PasswordRequestForm) -> dict[str, str | int]:
    user = authenticate(form_data.username, form_data.password)
    settings = get_settings()
    return {
        "access_token": create_access_token(
            user.username, user.role, settings.auth_token_expire_minutes
        ),
        "token_type": "bearer",
        "expires_in": settings.auth_token_expire_minutes * 60,
    }

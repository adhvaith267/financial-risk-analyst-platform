import json
from types import SimpleNamespace
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.auth import (
    RSAAlgorithm,
    _verify_google_id_token,
    authenticate,
    create_access_token,
    create_password_hash,
)
from app.core.config import Settings
from app.core.errors import AuthenticationRequiredError


def test_password_authentication_uses_hash_and_issues_claims():
    password_hash = create_password_hash("correct-password")
    settings = SimpleNamespace(
        auth_enabled=True,
        auth_username="analyst",
        auth_password_hash=password_hash,
        auth_role="analyst",
        auth_secret_key="test-secret-that-is-at-least-32-bytes",
    )

    with patch("app.auth.get_settings", return_value=settings):
        user = authenticate("analyst", "correct-password")
        token = create_access_token(user.username, user.role, 60)

    assert user.username == "analyst"
    assert token.count(".") == 2


def test_invalid_password_is_rejected():
    password_hash = create_password_hash("correct-password")
    settings = SimpleNamespace(
        auth_enabled=True,
        auth_username="analyst",
        auth_password_hash=password_hash,
        auth_role="analyst",
    )

    with patch("app.auth.get_settings", return_value=settings), pytest.raises(
        AuthenticationRequiredError
    ):
        authenticate("analyst", "wrong-password")


def test_production_requires_authentication_configuration():
    with pytest.raises(ValueError, match="AUTH_ENABLED"):
        Settings(
            app_env="production",
            db_host="localhost",
            db_password="test",
            auth_enabled=False,
        )


def test_google_id_token_signature_and_claims_are_verified():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    id_token = jwt.encode(
        {
            "iss": "https://accounts.google.com",
            "aud": "google-client",
            "email": "analyst@gmail.com",
            "email_verified": True,
            "nonce": "nonce-123",
        },
        private_key,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "keys": [
                    {
                        "kid": "test-key",
                        **json.loads(RSAAlgorithm.to_jwk(private_key.public_key())),
                    }
                ]
            }

    settings = SimpleNamespace(google_client_id="google-client")
    with patch("app.auth.get_settings", return_value=settings), patch(
        "app.auth.httpx.get", return_value=FakeResponse()
    ):
        claims = _verify_google_id_token(id_token, "nonce-123")

    assert claims["email"] == "analyst@gmail.com"

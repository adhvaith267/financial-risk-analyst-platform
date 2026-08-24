from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env",),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    aws_region: str = "ap-south-1"

    db_host: str
    db_port: int = 5432
    db_name: str = "fra"
    db_user: str = "fra_admin"
    db_password: str = Field(min_length=1)
    db_pool_size: int = Field(default=5, ge=1, le=50)
    db_max_overflow: int = Field(default=10, ge=0, le=100)
    db_pool_timeout_seconds: int = Field(default=10, ge=1, le=120)
    db_pool_recycle_seconds: int = Field(default=1800, ge=60, le=86400)

    sagemaker_endpoint_name: str = "gmsc-pd-endpoint"
    bedrock_model_id: str = "moonshot.kimi-k2-thinking"

    # Single-tenant platform authentication. Production must provide these
    # values through the private environment file; never commit credentials.
    auth_enabled: bool = True
    auth_username: str = ""
    auth_password_hash: str = ""
    auth_secret_key: str = Field(
        default="development-only-change-me-use-32-bytes", min_length=32
    )
    auth_role: Literal["analyst", "admin"] = "analyst"
    auth_token_expire_minutes: int = Field(default=60, ge=5, le=1440)

    google_auth_enabled: bool = False
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"
    google_frontend_redirect_uri: str = "http://localhost:5173/platform"
    google_allowed_email_domains: str = ""
    google_allowed_emails: str = ""

    # LGD assumption for the MVP: LGD = 1 - recovery_rate, used when a loan
    # doesn't specify its own recovery_rate.
    default_recovery_rate: float = 0.60

    # Mirrors the SageMaker endpoint's own RISK_THRESHOLD default (see the
    # financial-risk-analyst-ml repo's inference.py) — exposed here so the
    # API can report it back to callers rather than have them hardcode it.
    credit_decline_threshold: float = 0.10

    # Comma-separated browser origins allowed to call this API (CORS).
    # In production behind Nginx same-origin requests don't need CORS, but
    # this allows the Vite dev server (port 5173) to call the backend directly.
    allowed_origins: str = ""

    @field_validator("log_level")
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("LOG_LEVEL must be DEBUG, INFO, WARNING, ERROR, or CRITICAL")
        return normalized

    @model_validator(mode="after")
    def validate_production_auth(self) -> "Settings":
        if self.app_env == "production":
            if not self.auth_enabled:
                raise ValueError("AUTH_ENABLED must be true in production")
            missing = [
                name
                for name, value in {
                    "AUTH_SECRET_KEY": self.auth_secret_key,
                }.items()
                if not value.strip() or value == "development-only-change-me-use-32-bytes"
            ]
            if not self.google_auth_enabled:
                missing.extend(
                    name
                    for name, value in {
                        "AUTH_USERNAME": self.auth_username,
                        "AUTH_PASSWORD_HASH": self.auth_password_hash,
                    }.items()
                    if not value.strip()
                )
            if missing:
                raise ValueError(
                    "Production authentication is incomplete; set " + ", ".join(missing)
                )
            if self.google_auth_enabled:
                google_missing = [
                    name
                    for name, value in {
                        "GOOGLE_CLIENT_ID": self.google_client_id,
                        "GOOGLE_CLIENT_SECRET": self.google_client_secret,
                        "GOOGLE_REDIRECT_URI": self.google_redirect_uri,
                        "GOOGLE_FRONTEND_REDIRECT_URI": self.google_frontend_redirect_uri,
                    }.items()
                    if not value.strip()
                ]
                if google_missing:
                    raise ValueError(
                        "Google authentication is incomplete; set " + ", ".join(google_missing)
                    )
                if not (
                    self.google_allowed_email_domains.strip()
                    or self.google_allowed_emails.strip()
                ):
                    raise ValueError(
                        "Google authentication requires GOOGLE_ALLOWED_EMAILS or "
                        "GOOGLE_ALLOWED_EMAIL_DOMAINS"
                    )
        return self

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def google_allowed_domains_list(self) -> list[str]:
        return [
            domain.strip().lower()
            for domain in self.google_allowed_email_domains.split(",")
            if domain.strip()
        ]

    @property
    def google_allowed_emails_list(self) -> list[str]:
        return [
            email.strip().lower()
            for email in self.google_allowed_emails.split(",")
            if email.strip()
        ]

    @property
    def database_url(self) -> URL:
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

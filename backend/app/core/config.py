from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
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

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

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

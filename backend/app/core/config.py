from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    aws_region: str = "ap-south-1"

    db_host: str
    db_port: int = 5432
    db_name: str = "fra"
    db_user: str = "fra_admin"
    db_password: str

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
    allowed_origins: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

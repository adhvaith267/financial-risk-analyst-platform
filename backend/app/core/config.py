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

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

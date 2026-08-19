from datetime import datetime

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class RiskResult(Base):
    """A single computed risk assessment (credit or market) for a borrower or portfolio."""

    __tablename__ = "risk_results"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(20))  # "borrower" | "portfolio"
    entity_id: Mapped[str] = mapped_column(String(20))
    risk_type: Mapped[str] = mapped_column(String(20))  # "credit" | "market"
    payload: Mapped[dict] = mapped_column(JSON)  # pd/lgd/ead/el or var/es/volatility/... + model_version
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StressResult(Base):
    """Result of a scenario/stress test against a portfolio (and/or its credit book)."""

    __tablename__ = "stress_results"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    portfolio_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    scenario_name: Mapped[str] = mapped_column(String(100))
    shocks: Mapped[dict] = mapped_column(JSON)  # e.g. {"equity_shock": -0.20, "rate_shock_bps": 150, ...}
    market_loss: Mapped[float | None] = mapped_column(nullable=True)
    credit_loss: Mapped[float | None] = mapped_column(nullable=True)
    combined_loss: Mapped[float | None] = mapped_column(nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

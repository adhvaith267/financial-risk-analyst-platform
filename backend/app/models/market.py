from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Asset(Base):
    __tablename__ = "assets"

    asset_id: Mapped[str] = mapped_column(String(20), primary_key=True)  # ticker/symbol
    name: Mapped[str] = mapped_column(String(200))
    asset_class: Mapped[str] = mapped_column(String(50))  # equity, bond, cash, ...

    prices: Mapped[list["MarketPrice"]] = relationship(back_populates="asset")


class MarketPrice(Base):
    __tablename__ = "market_prices"
    __table_args__ = (
        UniqueConstraint("asset_id", "price_date", name="uq_market_price_asset_date"),
        Index("ix_market_prices_asset_date", "asset_id", "price_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.asset_id"))
    price_date: Mapped[date] = mapped_column(Date)
    close_price: Mapped[float] = mapped_column(Float)

    asset: Mapped["Asset"] = relationship(back_populates="prices")


class Portfolio(Base):
    __tablename__ = "portfolios"

    portfolio_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))

    holdings: Mapped[list["PortfolioHolding"]] = relationship(back_populates="portfolio")


class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"
    __table_args__ = (
        UniqueConstraint(
            "portfolio_id", "asset_id", "as_of_date", name="uq_portfolio_holding_snapshot"
        ),
        Index("ix_portfolio_holdings_portfolio", "portfolio_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    portfolio_id: Mapped[str] = mapped_column(ForeignKey("portfolios.portfolio_id"))
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.asset_id"))
    quantity: Mapped[float] = mapped_column(Float)
    as_of_date: Mapped[date] = mapped_column(Date)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="holdings")

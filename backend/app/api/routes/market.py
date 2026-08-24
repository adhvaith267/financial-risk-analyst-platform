from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_roles
from app.core.db import get_db
from app.core.identifiers import normalize_identifier
from app.engines.market_risk import assess_portfolio
from app.models.market import Portfolio
from app.models.risk import RiskResult
from app.schemas.market import MarketRiskResponse, PortfolioSummary

router = APIRouter(
    prefix="/market",
    tags=["market"],
    dependencies=[Depends(require_roles("analyst", "admin"))],
)


@router.get("/portfolios", response_model=list[PortfolioSummary])
def list_portfolios(db: Session = Depends(get_db)) -> list[PortfolioSummary]:
    portfolios = db.scalars(select(Portfolio).order_by(Portfolio.portfolio_id)).all()
    return [PortfolioSummary(portfolio_id=p.portfolio_id, name=p.name) for p in portfolios]


@router.get("/portfolios/{portfolio_id}/risk", response_model=MarketRiskResponse)
def risk(
    portfolio_id: str,
    lookback_days: int = Query(default=250, ge=30, le=2520),
    confidence_level: float = Query(default=0.95, ge=0.90, le=0.999),
    db: Session = Depends(get_db),
) -> MarketRiskResponse:
    portfolio_id = normalize_identifier(portfolio_id, "portfolio_id")
    result = assess_portfolio(
        db,
        portfolio_id,
        lookback_days=lookback_days,
        confidence_level=confidence_level,
    )

    db.add(
        RiskResult(
            entity_type="portfolio",
            entity_id=portfolio_id,
            risk_type="market",
            payload={
                "annualized_volatility": result.annualized_volatility,
                "historical_var_95": result.historical_var_95,
                "expected_shortfall_95": result.expected_shortfall_95,
                "max_drawdown": result.max_drawdown,
                "hhi": result.hhi,
                "confidence_level": result.confidence_level,
                "selected_var": result.selected_var,
                "selected_expected_shortfall": result.selected_expected_shortfall,
            },
        )
    )
    db.commit()

    return MarketRiskResponse(**result.__dict__)

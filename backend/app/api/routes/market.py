from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.engines.market_risk import assess_portfolio
from app.models.market import Portfolio
from app.models.risk import RiskResult
from app.schemas.market import MarketRiskResponse, PortfolioSummary

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/portfolios", response_model=list[PortfolioSummary])
def list_portfolios(db: Session = Depends(get_db)) -> list[PortfolioSummary]:
    portfolios = db.scalars(select(Portfolio).order_by(Portfolio.portfolio_id)).all()
    return [PortfolioSummary(portfolio_id=p.portfolio_id, name=p.name) for p in portfolios]


@router.get("/portfolios/{portfolio_id}/risk", response_model=MarketRiskResponse)
def risk(portfolio_id: str, db: Session = Depends(get_db)) -> MarketRiskResponse:
    try:
        result = assess_portfolio(db, portfolio_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

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
            },
        )
    )
    db.commit()

    return MarketRiskResponse(**result.__dict__)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.engines.market_risk import assess_portfolio
from app.schemas.market import MarketRiskResponse

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/portfolios/{portfolio_id}/risk", response_model=MarketRiskResponse)
def risk(portfolio_id: str, db: Session = Depends(get_db)) -> MarketRiskResponse:
    try:
        result = assess_portfolio(db, portfolio_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return MarketRiskResponse(**result.__dict__)

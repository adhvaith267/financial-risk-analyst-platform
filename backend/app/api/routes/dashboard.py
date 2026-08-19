from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.engines.market_risk import assess_portfolio
from app.models.borrower import Borrower, Loan
from app.models.market import Portfolio
from app.models.risk import StressResult
from app.schemas.dashboard import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db)) -> DashboardSummary:
    borrower_count = db.scalar(select(func.count()).select_from(Borrower)) or 0
    loan_count = db.scalar(select(func.count()).select_from(Loan)) or 0
    portfolio_count = db.scalar(select(func.count()).select_from(Portfolio)) or 0
    stress_test_count = db.scalar(select(func.count()).select_from(StressResult)) or 0

    headline_portfolio_id = db.scalars(select(Portfolio.portfolio_id).order_by(Portfolio.portfolio_id).limit(1)).first()
    annualized_volatility = None
    var_95 = None
    if headline_portfolio_id:
        try:
            result = assess_portfolio(db, headline_portfolio_id)
            annualized_volatility = result.annualized_volatility
            var_95 = result.historical_var_95
        except ValueError:
            pass

    return DashboardSummary(
        borrower_count=borrower_count,
        loan_count=loan_count,
        portfolio_count=portfolio_count,
        stress_test_count=stress_test_count,
        headline_portfolio_id=headline_portfolio_id,
        headline_annualized_volatility=annualized_volatility,
        headline_var_95=var_95,
    )

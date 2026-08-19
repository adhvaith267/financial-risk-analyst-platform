from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.engines.market_risk import assess_portfolio
from app.models.borrower import Borrower, Loan
from app.models.market import Portfolio
from app.models.risk import RiskResult, StressResult
from app.schemas.dashboard import DashboardSummary, RecentAnalysis, RiskDriverFrequency

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# How many recent credit assessments to scan when aggregating "top risk
# drivers" - a rolling window, not the full history.
RISK_DRIVER_LOOKBACK = 20
RECENT_ANALYSES_LIMIT = 5


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db)) -> DashboardSummary:
    borrower_count = db.scalar(select(func.count()).select_from(Borrower)) or 0
    loan_count = db.scalar(select(func.count()).select_from(Loan)) or 0
    portfolio_count = db.scalar(select(func.count()).select_from(Portfolio)) or 0
    stress_test_count = db.scalar(select(func.count()).select_from(StressResult)) or 0

    total_exposure = db.scalar(
        select(func.sum(Loan.outstanding_balance)).where(Loan.status == "active")
    ) or 0.0

    # Sum every portfolio's current market value; separately track the
    # headline (first) portfolio's full risk metrics for the KPI row.
    portfolio_ids = db.scalars(select(Portfolio.portfolio_id).order_by(Portfolio.portfolio_id)).all()
    total_portfolio_value = 0.0
    headline_portfolio_id = portfolio_ids[0] if portfolio_ids else None
    headline_annualized_volatility = None
    headline_var_95 = None
    headline_expected_shortfall_95 = None
    headline_max_drawdown = None
    for portfolio_id in portfolio_ids:
        try:
            result = assess_portfolio(db, portfolio_id)
        except ValueError:
            continue
        total_portfolio_value += result.portfolio_value
        if portfolio_id == headline_portfolio_id:
            headline_annualized_volatility = result.annualized_volatility
            headline_var_95 = result.historical_var_95
            headline_expected_shortfall_95 = result.expected_shortfall_95
            headline_max_drawdown = result.max_drawdown

    # "High-risk borrowers" and "top risk drivers" are both derived from the
    # borrowers actually assessed through this app (persisted to
    # risk_results) - not a fresh SageMaker call per borrower on every
    # dashboard load, which would be slow and expensive at any real scale.
    recent_credit_results = db.scalars(
        select(RiskResult)
        .where(RiskResult.risk_type == "credit")
        .order_by(RiskResult.computed_at.desc())
        .limit(200)
    ).all()

    latest_status_by_borrower: dict[str, str] = {}
    for row in recent_credit_results:
        if row.entity_id not in latest_status_by_borrower:
            latest_status_by_borrower[row.entity_id] = row.payload.get("status", "")
    high_risk_borrower_count = sum(
        1 for status in latest_status_by_borrower.values() if status == "DECLINED"
    )

    driver_counts: Counter[str] = Counter()
    for row in recent_credit_results[:RISK_DRIVER_LOOKBACK]:
        for driver in row.payload.get("risk_drivers", []):
            driver_counts[driver] += 1
    top_risk_drivers = [
        RiskDriverFrequency(driver=driver, count=count)
        for driver, count in driver_counts.most_common(5)
    ]

    recent_risk_results = db.scalars(
        select(RiskResult).order_by(RiskResult.computed_at.desc()).limit(RECENT_ANALYSES_LIMIT)
    ).all()
    recent_stress_results = db.scalars(
        select(StressResult).order_by(StressResult.computed_at.desc()).limit(RECENT_ANALYSES_LIMIT)
    ).all()

    recent_analyses = [
        RecentAnalysis(
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            risk_type=row.risk_type,
            label=row.payload.get("status") or ("Elevated" if row.risk_type == "market" else "Computed"),
            computed_at=str(row.computed_at),
        )
        for row in recent_risk_results
    ] + [
        RecentAnalysis(
            entity_type="portfolio",
            entity_id=row.portfolio_id or "-",
            risk_type="stress",
            label=row.scenario_name,
            computed_at=str(row.computed_at),
        )
        for row in recent_stress_results
    ]
    recent_analyses.sort(key=lambda item: item.computed_at, reverse=True)
    recent_analyses = recent_analyses[:RECENT_ANALYSES_LIMIT]

    return DashboardSummary(
        borrower_count=borrower_count,
        loan_count=loan_count,
        portfolio_count=portfolio_count,
        stress_test_count=stress_test_count,
        total_portfolio_value=total_portfolio_value,
        total_exposure=total_exposure,
        high_risk_borrower_count=high_risk_borrower_count,
        headline_portfolio_id=headline_portfolio_id,
        headline_annualized_volatility=headline_annualized_volatility,
        headline_var_95=headline_var_95,
        headline_expected_shortfall_95=headline_expected_shortfall_95,
        headline_max_drawdown=headline_max_drawdown,
        top_risk_drivers=top_risk_drivers,
        recent_analyses=recent_analyses,
    )

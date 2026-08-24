import json

from langchain_core.tools import StructuredTool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_engine
from app.engines.credit_risk import assess_borrower
from app.engines.market_risk import assess_portfolio
from app.engines.stress import StressScenario, run_stress_test
from app.models.borrower import Borrower, Loan
from app.models.market import Portfolio, PortfolioHolding
from app.services.sagemaker_client import PDModelUnavailableError

# Default recession scenario used when the user doesn't specify shock magnitudes.
DEFAULT_EQUITY_SHOCK = -0.20
DEFAULT_RATE_SHOCK_BPS = 150.0
DEFAULT_DEFAULT_SHOCK = 0.30


def _json(obj: dict) -> str:
    return json.dumps(obj, default=str)


def build_tools() -> list[StructuredTool]:
    """Each tool opens its own short-lived DB session per call (rather than
    sharing one Session across calls) because LangGraph's ToolNode may run
    multiple tool calls concurrently in separate threads, and SQLAlchemy
    Sessions aren't safe to share across threads. The agent decides which
    of these to call and in what order - it never computes PD, VaR, LGD,
    Expected Loss, etc. itself; every number here comes from the
    deterministic engines or SageMaker.
    """

    def get_borrower(borrower_id: str) -> str:
        """Look up a borrower's credit profile (age, income, utilization,
        delinquency history, etc.) and their active loan, if any."""
        with Session(get_engine()) as db:
            borrower = db.get(Borrower, borrower_id)
            if borrower is None:
                return _json({"error": f"Borrower {borrower_id} not found"})
            loan = db.scalars(
                select(Loan).where(Loan.borrower_id == borrower_id, Loan.status == "active").limit(1)
            ).first()
            return _json(
                {
                    "borrower_id": borrower.borrower_id,
                    "name": borrower.name,
                    "age": borrower.age,
                    "monthly_income": borrower.monthly_income,
                    "revolving_utilization": borrower.revolving_utilization_of_unsecured_lines,
                    "debt_ratio": borrower.debt_ratio,
                    "delinquencies_30_59d": borrower.number_of_time_30_59_days_past_due_not_worse,
                    "delinquencies_60_89d": borrower.number_of_time_60_89_days_past_due_not_worse,
                    "delinquencies_90d_plus": borrower.number_of_times_90_days_late,
                    "open_credit_lines": borrower.number_of_open_credit_lines_and_loans,
                    "real_estate_loans": borrower.number_real_estate_loans_or_lines,
                    "dependents": borrower.number_of_dependents,
                    "active_loan": (
                        {
                            "loan_id": loan.loan_id,
                            "loan_type": loan.loan_type,
                            "outstanding_balance": loan.outstanding_balance,
                            "recovery_rate": loan.recovery_rate,
                        }
                        if loan
                        else None
                    ),
                }
            )

    def get_portfolio(portfolio_id: str) -> str:
        """Look up a portfolio's current holdings (asset, quantity)."""
        with Session(get_engine()) as db:
            portfolio = db.get(Portfolio, portfolio_id)
            if portfolio is None:
                return _json({"error": f"Portfolio {portfolio_id} not found"})
            holdings = db.scalars(
                select(PortfolioHolding).where(PortfolioHolding.portfolio_id == portfolio_id)
            ).all()
            return _json(
                {
                    "portfolio_id": portfolio.portfolio_id,
                    "name": portfolio.name,
                    "holdings": [{"asset_id": h.asset_id, "quantity": h.quantity} for h in holdings],
                }
            )

    def assess_credit_risk(borrower_id: str) -> str:
        """Run the Credit Risk Engine for one borrower: gets PD from the
        SageMaker model, then computes LGD, EAD, and Expected Loss
        (EL = PD x LGD x EAD), plus the top SHAP-derived risk drivers."""
        with Session(get_engine()) as db:
            borrower = db.get(Borrower, borrower_id)
            if borrower is None:
                return _json({"error": f"Borrower {borrower_id} not found"})
            loan = db.scalars(
                select(Loan).where(Loan.borrower_id == borrower_id, Loan.status == "active").limit(1)
            ).first()
            try:
                result = assess_borrower(borrower, loan, explain=True)
            except PDModelUnavailableError as exc:
                return _json({"error": str(exc)})
            return _json(result.__dict__)

    def assess_market_risk(portfolio_id: str) -> str:
        """Run the Market Risk Engine for a portfolio: volatility, historical
        and parametric Value-at-Risk (95%/99%), Expected Shortfall, maximum
        drawdown, and concentration (HHI / largest position weight)."""
        with Session(get_engine()) as db:
            try:
                result = assess_portfolio(db, portfolio_id)
            except ValueError as exc:
                return _json({"error": str(exc)})
            return _json(result.__dict__)

    def run_stress_scenario(
        portfolio_id: str,
        equity_shock: float = DEFAULT_EQUITY_SHOCK,
        rate_shock_bps: float = DEFAULT_RATE_SHOCK_BPS,
        default_shock: float = DEFAULT_DEFAULT_SHOCK,
        scenario_name: str = "custom",
    ) -> str:
        """Run the Stress Testing Engine: apply an equity price shock (e.g.
        -0.20 for -20%), an interest rate shock in basis points (e.g. 150 for
        +150bps), and a relative default-rate shock (e.g. 0.30 for +30% PD)
        to a portfolio and the whole active loan book, returning market loss,
        credit loss, and their combined loss. If the user just says
        "recession" or gives no numbers, use the defaults."""
        scenario = StressScenario(
            name=scenario_name,
            equity_shock=equity_shock,
            rate_shock_bps=rate_shock_bps,
            default_shock=default_shock,
        )
        with Session(get_engine()) as db:
            try:
                result = run_stress_test(db, portfolio_id, scenario)
            except (ValueError, PDModelUnavailableError) as exc:
                return _json({"error": str(exc)})
            payload = {
                "portfolio_id": result.portfolio_id,
                "scenario": scenario.name,
                "equity_shock": scenario.equity_shock,
                "rate_shock_bps": scenario.rate_shock_bps,
                "default_shock": scenario.default_shock,
                "market_loss": result.market_loss,
                "credit_loss": result.credit_loss,
                "combined_loss": result.combined_loss,
                "baseline_portfolio_value": result.baseline_portfolio_value,
                "stressed_portfolio_value": result.stressed_portfolio_value,
            }
            return _json(payload)

    return [
        StructuredTool.from_function(func=get_borrower, name="get_borrower"),
        StructuredTool.from_function(func=get_portfolio, name="get_portfolio"),
        StructuredTool.from_function(func=assess_credit_risk, name="assess_credit_risk"),
        StructuredTool.from_function(func=assess_market_risk, name="assess_market_risk"),
        StructuredTool.from_function(func=run_stress_scenario, name="run_stress_scenario"),
    ]

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    borrower_count: int
    loan_count: int
    portfolio_count: int
    stress_test_count: int
    headline_portfolio_id: str | None
    headline_annualized_volatility: float | None
    headline_var_95: float | None

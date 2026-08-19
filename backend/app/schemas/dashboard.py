from pydantic import BaseModel


class RiskDriverFrequency(BaseModel):
    driver: str
    count: int


class RecentAnalysis(BaseModel):
    entity_type: str  # "borrower" | "portfolio"
    entity_id: str
    risk_type: str  # "credit" | "market" | "stress"
    label: str
    computed_at: str


class DashboardSummary(BaseModel):
    borrower_count: int
    loan_count: int
    portfolio_count: int
    stress_test_count: int

    total_portfolio_value: float
    total_exposure: float
    high_risk_borrower_count: int

    headline_portfolio_id: str | None
    headline_annualized_volatility: float | None
    headline_var_95: float | None
    headline_expected_shortfall_95: float | None
    headline_max_drawdown: float | None

    top_risk_drivers: list[RiskDriverFrequency]
    recent_analyses: list[RecentAnalysis]

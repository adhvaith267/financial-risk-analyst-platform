from pydantic import BaseModel


class StressScenarioRequest(BaseModel):
    scenario_name: str = "custom"
    equity_shock: float = -0.20
    rate_shock_bps: float = 150.0
    default_shock: float = 0.30


class StressResultResponse(BaseModel):
    portfolio_id: str
    scenario_name: str
    equity_shock: float
    rate_shock_bps: float
    default_shock: float
    market_loss: float
    credit_loss: float
    combined_loss: float
    baseline_portfolio_value: float
    stressed_portfolio_value: float
    baseline_total_expected_loss: float
    stressed_total_expected_loss: float
    vulnerabilities: list[str]

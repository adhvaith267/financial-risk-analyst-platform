from pydantic import BaseModel, Field


class StressScenarioRequest(BaseModel):
    scenario_name: str = Field(default="custom", min_length=1, max_length=100)
    equity_shock: float = Field(default=-0.20, ge=-1.0, le=0.0)
    rate_shock_bps: float = Field(default=150.0, ge=-1000.0, le=2000.0)
    default_shock: float = Field(default=0.30, ge=0.0, le=10.0)


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

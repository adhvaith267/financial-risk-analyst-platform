from pydantic import BaseModel


class MarketRiskResponse(BaseModel):
    portfolio_id: str
    as_of: str
    portfolio_value: float
    daily_volatility: float
    annualized_volatility: float
    historical_var_95: float
    historical_var_99: float
    parametric_var_95: float
    expected_shortfall_95: float
    max_drawdown: float
    hhi: float
    max_position_weight: float
    weights: dict[str, float]
    correlation_matrix: dict[str, dict[str, float]]
    value_history: list[dict]
    risk_drivers: list[str]


class PortfolioSummary(BaseModel):
    portfolio_id: str
    name: str
